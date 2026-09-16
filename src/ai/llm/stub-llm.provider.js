/**
 * Deterministic offline LLM provider (development/test only).
 *
 * Implements the same interface as the Anthropic provider:
 * `completeJson({ task, system, user }) -> object`. Responses are generated
 * from fixed templates keyed by `task`, so e2e tests are stable without any
 * network call. Zod validation of the returned JSON still applies at the
 * service boundary exactly as it would for a real model.
 */

function topicKeywords(topicTitle) {
  return topicTitle
    .toLowerCase()
    .split(/[^a-z\u0600-\u06ff]+/)
    .filter((word) => word.length >= 4);
}

const QUESTION_TEMPLATES = [
  (topicTitle, objective) =>
    `Explain ${topicTitle} in your own words${objective ? `, focusing on: ${objective}` : ''}, and give one concrete example.`,
  (topicTitle) =>
    `Describe a realistic problem where ${topicTitle} is needed, then walk through how you would solve it step by step.`,
];

export function createStubLlmProvider({ modelName }) {
  return {
    name: 'stub',
    model: modelName,

    async completeJson({ task, user, payload }) {
      // The service passes the task input as a JSON string in `user` (the
      // same content a real model would read); `payload` is accepted as an
      // alternative for direct calls.
      const input = payload ?? JSON.parse(user);

      if (task === 'generate_diagnostic_questions') {
        const questions = [];
        for (const topic of input.topics) {
          for (let i = 0; i < input.questionsPerTopic; i += 1) {
            const template = QUESTION_TEMPLATES[i % QUESTION_TEMPLATES.length];
            const objective = topic.objectives[i % Math.max(topic.objectives.length, 1)];
            questions.push({
              topicId: topic.id,
              objectiveCode: objective?.code ?? null,
              prompt: template(topic.title, objective?.description),
              difficulty: i === 0 ? 'easy' : 'medium',
            });
          }
        }
        return { questions };
      }

      if (task === 'evaluate_answer') {
        const answerText = String(input.answerText ?? '');
        const keywords = topicKeywords(input.topicTitle);
        const mentionsTopic =
          keywords.length > 0 && keywords.some((word) => answerText.toLowerCase().includes(word));

        let correctness;
        if (mentionsTopic && answerText.length >= 80) {
          correctness = 'correct';
        } else if (answerText.length >= 30) {
          correctness = 'partial';
        } else {
          correctness = 'incorrect';
        }

        const misconceptions =
          correctness === 'incorrect'
            ? [
                {
                  code: 'OFF_TOPIC_RESPONSE',
                  description: `The response does not connect to the core ideas of ${input.topicTitle}`,
                },
              ]
            : correctness === 'partial'
              ? [
                  {
                    code: 'INCOMPLETE_RESPONSE',
                    description: 'The response is on topic but incomplete',
                  },
                ]
              : [];

        const feedback =
          correctness === 'correct'
            ? `Good work: the answer addresses ${input.topicTitle} with enough detail.`
            : correctness === 'partial'
              ? 'The answer touches the topic but needs more depth and concrete detail.'
              : `The answer is too thin or off topic; review the material on ${input.topicTitle}.`;

        return {
          correctness,
          confidence: correctness === 'correct' ? 0.9 : correctness === 'partial' ? 0.6 : 0.8,
          misconceptions,
          feedback,
        };
      }

      if (task === 'generate_practice_questions' || task === 'generate_reassessment_questions') {
        const count = Math.max(1, Math.min(Number(input.count ?? 3), 10));
        const questions = [];
        for (let i = 0; i < count; i += 1) {
          const template = QUESTION_TEMPLATES[i % QUESTION_TEMPLATES.length];
          const objectives = Array.isArray(input.objectives) ? input.objectives : [];
          const objective = objectives[i % Math.max(objectives.length, 1)];
          questions.push({
            prompt: template(input.topicTitle, objective?.description),
            difficulty: i === 0 ? 'easy' : i % 2 === 0 ? 'medium' : 'hard',
          });
        }
        return { questions };
      }

      if (task === 'grade_assignment_answer') {
        const answerText = String(input.answerText ?? '');
        const maxScore = Number(input.maxScore ?? 10);
        const keywords = [
          ...topicKeywords(input.topicTitle ?? ''),
          ...topicKeywords(String(input.modelAnswer ?? '')),
        ];
        const mentionsSource =
          keywords.length > 0 && keywords.some((word) => answerText.toLowerCase().includes(word));

        let correctness;
        if (mentionsSource && answerText.length >= 80) {
          correctness = 'CORRECT';
        } else if (answerText.length >= 30) {
          correctness = 'PARTIAL';
        } else {
          correctness = 'INCORRECT';
        }

        const score =
          correctness === 'CORRECT' ? maxScore : correctness === 'PARTIAL' ? maxScore / 2 : 0;

        const confidence =
          input.hasModelAnswer || input.hasRubric ? 'HIGH' : 'MEDIUM';

        const misconceptions =
          correctness === 'INCORRECT'
            ? [
                {
                  code: 'OFF_TOPIC_RESPONSE',
                  description: `The response does not connect to the core ideas of ${input.topicTitle ?? 'the question'}`,
                },
              ]
            : correctness === 'PARTIAL'
              ? [
                  {
                    code: 'INCOMPLETE_RESPONSE',
                    description: 'The response is on topic but incomplete',
                  },
                ]
              : [];

        const feedbackText =
          correctness === 'CORRECT'
            ? 'Complete and on-topic answer that addresses the key ideas with enough detail.'
            : correctness === 'PARTIAL'
              ? 'The answer touches the key ideas but needs more depth and precision.'
              : 'The answer is too thin or off topic compared with the expected solution.';

        const rubricBreakdown = input.rubricText
          ? [
              {
                criterion: 'overall',
                awardedScore: score,
                maxScore,
                guidance: String(input.rubricText).slice(0, 300),
              },
            ]
          : null;

        return { score, correctness, confidence, feedbackText, misconceptions, rubricBreakdown };
      }

      if (task === 'answer_tutor_question') {
        // Deterministic grounded answer: restates the trusted excerpts the
        // retrieval gate selected and cites every chunk it was given. The
        // real provider must follow the same contract (cite only provided
        // chunk ids); the service strips anything else.
        const contexts = Array.isArray(input.contexts) ? input.contexts : [];
        const sourceLines = contexts
          .map((context) => `- ${String(context.text).slice(0, 200)}`)
          .join('\n');
        const answer =
          `Based on the trusted course material for ${input.topicTitle}:\n\n${sourceLines}\n\n` +
          `In short: these excerpts cover the key ideas of ${input.topicTitle} needed for ` +
          `"${input.question}" - follow the cited excerpts for the full worked detail.`;
        return { answer, usedChunkIds: contexts.map((context) => context.id) };
      }

      if (task === 'generate_remedial_content') {
        const excerpts = Array.isArray(input.excerpts) ? input.excerpts : [];
        const focus = input.misconception
          ? `the misconception ${input.misconception.code} (${input.misconception.description})`
          : `the topic ${input.topicTitle}`;
        const sourceLines = excerpts
          .map((excerpt) => `- ${String(excerpt.text).slice(0, 200)}`)
          .join('\n');
        const title =
          input.contentType === 'EXTRA_PRACTICE_QUESTIONS'
            ? `Extra practice on ${input.topicTitle}`
            : `Focused explanation: ${input.topicTitle}`;
        const body =
          input.contentType === 'EXTRA_PRACTICE_QUESTIONS'
            ? `This practice set targets ${focus}. It is built only from the trusted course material below.\n${sourceLines}\n\n` +
              `1) Solve a new problem on ${input.topicTitle} using the cited excerpts, then verify each step against the material.\n` +
              `2) Re-derive the key rule from the excerpts and apply it to a different example.`
            : `This focused explanation targets ${focus}. It is grounded in the trusted course material below.\n${sourceLines}\n\n` +
              `Worked example: follow the cited excerpts step by step, then compare your result with the corrected approach described there.`;
        return { title, body };
      }

      throw new Error(`Stub LLM provider does not implement task "${task}"`);
    },
  };
}