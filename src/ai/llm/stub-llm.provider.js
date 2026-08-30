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

      throw new Error(`Stub LLM provider does not implement task "${task}"`);
    },
  };
}