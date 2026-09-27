import { logger } from '../../config/logger.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../../config/index.js';
import { AiProviderError, ForbiddenError, NotFoundError } from '../../shared/errors/index.js';
import { toPublicResource } from './generated-resource.model.js';
import {
  isWebSearchEnabled,
  searchTrustedSources,
} from '../../shared/web/trusted-search.js';
import { fallbackDiagramSpec, renderFlowDiagram } from '../../shared/artifacts/flow-diagram.js';
import { buildPresentationBuffer, fallbackOutline } from '../../shared/artifacts/pptx-builder.js';
import {
  llmDeckOutlineSchema,
  llmDiagramSpecSchema,
  llmTextResourceSchemas,
} from './learning-resources.schema.js';

// The last eight kinds are authored as one markdown text block ({"text"}),
// the same shape the AI engine returns and the Study Tools page renders.
const STRUCTURED_KINDS = ['summary', 'notes', 'flashcards', 'quiz', 'code', 'diagram', 'presentation'];
const TEXT_KINDS = [
  'summary', 'notes', 'flashcards', 'quiz', 'code',
  'explanation', 'study_guide', 'coding_exercise', 'analogy', 'comparison', 'exam', 'practice', 'question_bank',
];
const STUDY_TOOLS_CONCURRENCY = 1;
const MEDIA_KINDS = ['image', 'audio', 'video'];
const KIND_INSTRUCTIONS = {
  summary:
    'A focused study summary: {"title":string,"points":[3-8 concise points],"takeaway":string}.',
  notes:
    'Structured study notes: {"title":string,"sections":[{"heading":string,"bullets":[1-8 bullets]}]} with 2-8 sections.',
  flashcards:
    'Revision flashcards: {"cards":[{"front":question-or-term,"back":answer-or-definition}]} with 4-12 cards.',
  quiz:
    'A practice quiz: {"questions":[{"question":string,"options":[exactly 4],"answerIndex":0-3,"why":string}]} with 3-10 questions.',
  code:
    'A complete, runnable code example: {"language":string,"code":complete runnable code,"explanation":string}. The code must be self-contained and syntactically valid.',
  explanation:
    'A clear step-by-step explanation of the topic for a student, with a small example. Return {"text": markdown}.',
  study_guide:
    'A study guide: key concepts, what to memorize, common mistakes and a short self-check list. Return {"text": markdown}.',
  coding_exercise:
    'One coding exercise on the topic: problem statement, input/output example, hints, then a full solution in a separate section. Return {"text": markdown}.',
  analogy:
    'Two or three everyday analogies that make the topic intuitive, each followed by where the analogy breaks down. Return {"text": markdown}.',
  comparison:
    'A comparison of the main approaches/variants within the topic as a markdown table plus a short "when to use which". Return {"text": markdown}.',
  exam:
    'A model exam: 6-10 mixed questions (short answer and problem solving) with marks, followed by a model answer key. Return {"text": markdown}.',
  practice:
    'A practice set of 5-8 graded questions from easy to hard, each with its answer. Return {"text": markdown}.',
  question_bank:
    'A question bank of 10-15 varied questions grouped by difficulty, with brief answers. Return {"text": markdown}.',
};

// Models sometimes rename the top-level array ("quiz", "items") or wrap the
// payload in one extra object; map those onto the documented contract
// before validation instead of discarding otherwise good content.
const ARRAY_KEY = { quiz: 'questions', flashcards: 'cards', notes: 'sections', summary: 'points' };
function normalizeShape(kind, raw) {
  let value = raw;
  // Echo of the request envelope: {"topic", "resource": "<the JSON as a string>"}.
  if (value && typeof value === 'object' && typeof value.resource === 'string') {
    try {
      const inner = JSON.parse(value.resource);
      if (inner && typeof inner === 'object') value = inner;
    } catch {
      // not JSON: leave as is
    }
  } else if (value && typeof value === 'object' && value.resource && typeof value.resource === 'object') {
    value = value.resource;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length === 1 && value[keys[0]] && typeof value[keys[0]] === 'object' && !Array.isArray(value[keys[0]])) {
      value = value[keys[0]];
    }
  }
  const key = ARRAY_KEY[kind];
  if (Array.isArray(value) && key) return { [key]: value };
  if (key && value && typeof value === 'object' && !Array.isArray(value[key])) {
    const firstArray = Object.values(value).find((item) => Array.isArray(item));
    if (firstArray) return { ...value, [key]: firstArray };
  }
  if (!ARRAY_KEY[kind] && value && typeof value === 'object' && typeof value.text !== 'string') {
    const firstString = Object.values(value).find((item) => typeof item === 'string' && item.length > 40);
    if (firstString && llmTextResourceSchemas[kind]?.shape?.text) return { text: firstString };
  }
  return value;
}

/**
 * Learning-resource generation (EDUNation "Study Tools" parity). Per-kind
 * isolation: one failing kind never fails the batch. Text kinds go through
 * the LLM with per-kind Zod contracts; diagram/presentation are REAL
 * artifacts built deterministically from validated specs (never raw model
 * markup). Media kinds without a real provider are reported unavailable -
 * the platform never fabricates artifacts (reference truthfulness rule).
 */
export function createLearningResourcesService({
  coursesService,
  retrievalService,
  generatedResourceRepository,
  llmProvider,
  learnerModelService = null,
  lernaService = null,
}) {
  // Cached per boot: the model name LeRna actually answers with (null in its
  // deterministic test mode, so no provider is ever falsely credited).
  let lernaModelName;
  async function lernaModel() {
    if (lernaModelName !== undefined) return lernaModelName;
    try {
      const status = await lernaService.health();
      const ai = status?.ai_status ?? {};
      lernaModelName = ai.llm_provider && ai.llm_provider !== 'mock' ? (ai.llm_model ?? null) : null;
    } catch {
      lernaModelName = null;
    }
    return lernaModelName;
  }
  async function resolveCourseMember(user, courseId) {
    try {
      return await coursesService.ensureStudentCourseAccess(user, courseId);
    } catch (studentError) {
      try {
        return await coursesService.ensureInstructorCourseAccess(user, courseId);
      } catch {
        throw studentError;
      }
    }
  }

  function courseDocumentId(course) {
    return course.id ?? String(course._id);
  }

  async function gatherEvidence(courseId, topic) {
    try {
      const { contexts } = await retrievalService.retrieveContext({ courseId, query: topic });
      if (contexts.length > 0) {
        return {
          knowledgeSource: 'uploaded_material',
          evidenceText: contexts
            .slice(0, 4)
            .map((context, index) => `[M${index + 1}] ${context.text.slice(0, 900)}`)
            .join('\n\n'),
        };
      }
    } catch {
      // Retrieval failure must not block generation; try external evidence.
    }
    if (isWebSearchEnabled()) {
      const { state, sources } = await searchTrustedSources({ query: topic });
      if (state === 'ready' && sources.length > 0) {
        return {
          knowledgeSource: 'trusted_external',
          evidenceText: sources
            .slice(0, 3)
            .map((source, index) => `[W${index + 1}] (${source.url}) ${source.text.slice(0, 900)}`)
            .join('\n\n'),
        };
      }
    }
    return { knowledgeSource: 'none', evidenceText: '' };
  }

  async function learnerFocus(user, courseId) {
    // Learner targeting (EDUNation parity): generation prioritizes the
    // student's actual gap topics as computed by the deterministic learner
    // model. Instructors/personal spaces without evidence simply get [].
    if (!learnerModelService?.getLearnerModel) return [];
    try {
      const model = await learnerModelService.getLearnerModel(user, courseId);
      return (model?.gaps ?? [])
        .map((gap) => String(gap.title ?? ''))
        .filter(Boolean)
        .slice(0, 5);
    } catch {
      return [];
    }
  }

  // Every language the API accepts (see learning-resources.schema.js).
  const LANGUAGE_NAMES = {
    en: 'English',
    ar: 'Arabic (Modern Standard)',
    fr: 'French',
    sw: 'Swahili',
    ha: 'Hausa',
    am: 'Amharic (Ge\'ez script)',
    so: 'Somali',
    yo: 'Yoruba',
    ig: 'Igbo',
    zu: 'Zulu',
  };

  function languageLine(language) {
    if (!language || language === 'en') return 'Write in clear academic English.';
    const name = LANGUAGE_NAMES[language] ?? 'English';
    return (
      `Write ALL user-facing text (titles, points, cards, questions, options, explanations, labels) in ${name}. ` +
      'Do not answer in English. Keep code, formulas and standard technical terms in English where that is the norm, ' +
      `but explain them in ${name}. JSON keys stay exactly as specified in English.`
    );
  }

  async function generateTextKind(kind, { topic, language, focus, evidenceText }) {
    const system =
      'You generate study resources for an academic learning platform. Ground the content in the provided evidence when it is present; ' +
      'when no evidence is provided, produce standard, accurate academic study material without fabricating citations or sources. ' +
      languageLine(language) +
      (focus.length > 0
        ? ` Prioritize these learner weak points: ${focus.join(', ')}.`
        : '') +
      ' Respond with JSON only: return ONLY the resource object described in "resource" (not the request fields).';
    const user = JSON.stringify({
      topic,
      resource: KIND_INSTRUCTIONS[kind],
      evidence: evidenceText || null,
    });
    // One retry: JSON-mode providers occasionally reject/garble a long output.
    let parsed = { success: false };
    let lastRaw = null;
    for (let attempt = 0; attempt < 2 && !parsed.success; attempt += 1) {
      try {
        const raw = await llmProvider.completeJson({ task: `generate_${kind}`, system, user });
        lastRaw = raw;
        parsed = llmTextResourceSchemas[kind].safeParse(normalizeShape(kind, raw));
      } catch (error) {
        if (attempt === 1) throw error;
      }
    }
    if (!parsed.success) {
      logger.warn({ kind, issues: parsed.error?.issues?.slice(0, 2), sample: JSON.stringify(lastRaw ?? null).slice(0, 400) }, 'Study tools: model output failed validation');
      throw new AiProviderError(`generate_${kind}: AI provider returned invalid output`);
    }
    return { type: 'text', content: parsed.data, usedModel: true };
  }

  async function buildDiagram({ courseId, topic, language, focus, evidenceText, batchId }) {
    let spec = null;
    try {
      const raw = await llmProvider.completeJson({
        task: 'diagram_spec',
        system:
          'Design a learning flow diagram spec for the topic. Return JSON {"title":string,"steps":[{"label":short,"detail":optional short}] } with 3-6 ordered steps. ' +
          languageLine(language) +
          (focus.length > 0 ? ` Emphasize: ${focus.join(', ')}.` : '') +
          ' Respond with JSON only.',
        user: JSON.stringify({ topic, evidence: evidenceText || null }),
      });
      const parsed = llmDiagramSpecSchema.safeParse(raw);
      if (parsed.success) spec = parsed.data;
    } catch {
      // Deterministic fallback below (provider-independent, reference parity).
    }
    const usedModel = Boolean(spec);
    if (!spec) spec = fallbackDiagramSpec(topic, language);
    const svg = renderFlowDiagram(spec);
    const dir = path.join(config.artifacts.dir, courseDocumentId({ id: courseId }), batchId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, 'diagram.svg');
    await fs.writeFile(filePath, svg, 'utf8');
    return {
      type: 'file',
      artifactRelativePath: path.relative(config.artifacts.dir, filePath),
      mime: 'image/svg+xml',
      content: { specTitle: spec.title },
      usedModel,
    };
  }

  async function buildDeck({ courseId, topic, language, focus, evidenceText, batchId }) {
    let outline = null;
    try {
      const raw = await llmProvider.completeJson({
        task: 'deck_outline',
        system:
          'Design a study slide-deck outline for the topic. Return JSON {"title":string,"subtitle":optional,"slides":[{"title":string,"bullets":[1-6 bullets]}]} with 4-8 slides. ' +
          languageLine(language) +
          (focus.length > 0 ? ` Emphasize: ${focus.join(', ')}.` : '') +
          ' Respond with JSON only.',
        user: JSON.stringify({ topic, evidence: evidenceText || null }),
      });
      const parsed = llmDeckOutlineSchema.safeParse(raw);
      if (parsed.success) outline = parsed.data;
    } catch {
      // Deterministic fallback below.
    }
    const usedModel = Boolean(outline);
    if (!outline) outline = fallbackOutline(topic, language);
    const buffer = await buildPresentationBuffer(outline);
    const dir = path.join(config.artifacts.dir, courseDocumentId({ id: courseId }), batchId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, 'presentation.pptx');
    await fs.writeFile(filePath, buffer);
    return {
      type: 'file',
      artifactRelativePath: path.relative(config.artifacts.dir, filePath),
      mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      content: { deckTitle: outline.title, slideCount: (outline.slides ?? []).length + 1 },
      usedModel,
    };
  }

  async function generate(user, courseId, data) {
    const course = await resolveCourseMember(user, courseId);
    const docCourseId = courseDocumentId(course);
    const batchId = data.batchId ?? crypto.randomUUID().slice(0, 8);
    const focus = await learnerFocus(user, docCourseId);
    const results = [];

    // LeRna (Academic OS) is the AI source of truth once enabled: the whole
    // 15-kind generation contract runs there; media kinds remain an honest
    // client-side `unavailable` (LeRna has no real media provider either).
    // When the engine is down (or up without a working model) the local
    // generator below produces the same resources from course evidence.
    //
    // Kinds the UI renders from structured data (cards, quiz questions, SVG
    // diagram, PPTX deck...) always use the local generator, because LeRna
    // returns them as plain text. LeRna handles the free-text kinds, and any
    // kind it fails on is regenerated locally in the same batch.
    if (
      !data.localOnly &&
      config.lerna.enabled && lernaService?.isReady?.() &&
      (lernaService.canGenerate ? await lernaService.canGenerate() : true)
    ) {
      const lernaKinds = data.kinds.filter((kind) => !STRUCTURED_KINDS.includes(kind));
      const viaLerna = lernaKinds.length
        ? await generateViaLerna(user, course, { ...data, kinds: lernaKinds }, batchId, [])
        : { items: [] };
      const failedKinds = [];
      for (const item of viaLerna.items) {
        if (item.status !== 'ready') {
          failedKinds.push(item.kind);
          await generatedResourceRepository.deleteById(item.id);
        }
      }
      const localKinds = data.kinds.filter((kind) => STRUCTURED_KINDS.includes(kind) || failedKinds.includes(kind));
      const local = localKinds.length
        ? await generate(user, courseId, { ...data, kinds: localKinds, localOnly: true, batchId })
        : { items: [] };
      const byKind = new Map([...viaLerna.items.filter((item) => item.status === 'ready'), ...local.items].map((item) => [item.kind, item]));
      return { batchId, items: data.kinds.map((kind) => byKind.get(kind)).filter(Boolean) };
    }

    // Evidence is fetched once and shared; kinds run through a small pool (a batch of
    // Groq rate limits (tokens/minute) make parallel calls slower, so the pool
    // size is 1 by default; results keep request order.
    let evidencePromise = null;
    const getEvidence = () => (evidencePromise ??= gatherEvidence(docCourseId, data.topic));
    const runKind = async (kind) => {
      let record;
      let produced = null; // set only when the LLM truly produced the content
      try {
        if (MEDIA_KINDS.includes(kind)) {
          record = {
            status: 'unavailable',
            unavailableReason:
              'No real media generation provider is configured for this resource type; it is reported unavailable instead of being faked.',
            knowledgeSource: 'none',
          };
        } else {
          const { knowledgeSource, evidenceText } = await getEvidence();
          if (TEXT_KINDS.includes(kind)) {
            produced = await generateTextKind(kind, {
              topic: data.topic,
              language: data.language,
              focus,
              evidenceText,
            });
          } else if (kind === 'diagram') {
            produced = await buildDiagram({
              courseId: docCourseId,
              topic: data.topic,
              language: data.language,
              focus,
              evidenceText,
              batchId,
            });
          } else if (kind === 'presentation') {
            produced = await buildDeck({
              courseId: docCourseId,
              topic: data.topic,
              language: data.language,
              focus,
              evidenceText,
              batchId,
            });
          }
          record = {
            status: 'ready',
            content: produced.content ?? null,
            artifactPath: produced.artifactRelativePath ?? null,
            mime: produced.mime ?? null,
            unavailableReason: null,
            knowledgeSource,
          };
        }
      } catch (error) {
        logger.warn({ kind, err: error.message, details: error.details }, 'Study tools: local generation failed');
        // Per-kind isolation with an HONEST failure state (never fake).
        record = {
          status: 'unavailable',
          unavailableReason:
            error instanceof AiProviderError
              ? 'The generation provider could not produce this resource reliably right now.'
              : 'This resource could not be generated right now.',
          knowledgeSource: 'none',
        };
      }

      const doc = await generatedResourceRepository.createResource({
        courseId: docCourseId,
        userId: user.id,
        topic: data.topic,
        language: data.language,
        kind,
        batchId,
        model: record.status === 'ready' && produced?.usedModel ? llmProvider.model : null,
        institutionId: course.institutionId ?? null,
        isPersonal: Boolean(course.isPersonal),
        ...record,
      });
      return toPublicResource(doc);
    };
    const ordered = new Array(data.kinds.length);
    let next = 0;
    const worker = async () => {
      while (next < data.kinds.length) {
        const index = next++;
        ordered[index] = await runKind(data.kinds[index]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(STUDY_TOOLS_CONCURRENCY, data.kinds.length) }, worker));
    results.push(...ordered);
    return { batchId, items: results };
  }

  async function generateViaLerna(user, course, data, batchId, results) {
    const docCourseId = courseDocumentId(course);
    const lernaKinds = data.kinds.filter((kind) => !MEDIA_KINDS.includes(kind));

    // One batched AI call per LeRna contract; a whole-service failure marks
    // every requested kind honestly unavailable (no fabricated content).
    let resourcesByKind = {};
    let batchError = null;
    if (lernaKinds.length > 0) {
      try {
        const response = await lernaService.generateStudyTools({
          user,
          course,
          topic: data.topic,
          kinds: lernaKinds,
          language: data.language,
        });
        resourcesByKind = response?.resources ?? {};
      } catch (error) {
        batchError = error;
      }
    }

    const modelName = await lernaModel();
    for (const kind of data.kinds) {
      let record;
      let usedModel = false;
      try {
        if (MEDIA_KINDS.includes(kind)) {
          record = {
            status: 'unavailable',
            unavailableReason:
              'No real media generation provider is configured for this resource type; it is reported unavailable instead of being faked.',
            knowledgeSource: 'none',
            content: null,
            artifactPath: null,
            mime: null,
          };
        } else if (batchError) {
          record = {
            status: 'unavailable',
            unavailableReason:
              'The AI service could not generate this resource right now; it is reported honestly instead of being faked.',
            knowledgeSource: 'none',
            content: null,
            artifactPath: null,
          };
        } else {
          const resource = resourcesByKind[kind];
          if (!resource) {
            record = {
              status: 'unavailable',
              unavailableReason:
                'The AI service did not return this resource kind for the requested topic.',
              knowledgeSource: 'none',
              content: null,
              artifactPath: null,
            };
          } else if (resource.type === 'file') {
            const downloaded = await lernaService.downloadArtifact(resource.download_url, user);
            const dir = path.join(config.artifacts.dir, docCourseId, batchId);
            await fs.mkdir(dir, { recursive: true });
            const safeName = path.basename(resource.filename ?? `${kind}`);
            const filePath = path.join(dir, safeName);
            await fs.writeFile(filePath, downloaded.buffer);
            record = {
              status: 'ready',
              content: null,
              artifactPath: path.relative(config.artifacts.dir, filePath),
              mime: resource.mime_type ?? downloaded.mime,
              knowledgeSource: (resource.sources ?? []).length > 0 ? 'trusted_external' : 'none',
            };
            usedModel = true; // LeRna generated the artifact through its LLM pipeline
          } else {
            record = {
              status: 'ready',
              content: { text: String(resource.content ?? '') },
              artifactPath: null,
              mime: null,
              knowledgeSource: (resource.sources ?? []).length > 0 ? 'trusted_external' : 'none',
            };
            usedModel = true;
          }
        }
      } catch (error) {
        record = {
          status: 'unavailable',
          unavailableReason:
            'This resource could not be generated right now.',
          knowledgeSource: 'none',
          content: null,
          artifactPath: null,
        };
        usedModel = false;
      }

      const doc = await generatedResourceRepository.createResource({
        courseId: docCourseId,
        userId: user.id,
        topic: data.topic,
        language: data.language,
        kind,
        batchId,
        model: record.status === 'ready' && usedModel ? modelName : null,
        institutionId: course.institutionId ?? null,
        isPersonal: Boolean(course.isPersonal),
        ...record,
      });
      results.push(toPublicResource(doc));
    }
    return { batchId, items: results };
  }

  async function listMine(user, courseId, { page, limit }) {
    const course = await resolveCourseMember(user, courseId);
    const { items, total } = await generatedResourceRepository.listByUserCourse(
      user.id,
      courseDocumentId(course),
      { skip: (page - 1) * limit, limit },
    );
    return { items: items.map((item) => toPublicResource({ ...item, _id: item._id })), total, page, limit };
  }

  async function downloadArtifact(user, resourceId) {
    const resource = await generatedResourceRepository.findById(resourceId);
    if (!resource || String(resource.userId) !== String(user.id)) {
      throw new NotFoundError('Resource not found');
    }
    if (!resource.artifactPath) {
      throw new NotFoundError('This resource has no downloadable artifact');
    }
    // Path traversal guard: stored paths are always relative to the artifacts
    // root; resolve and verify containment before touching the filesystem.
    const root = path.resolve(config.artifacts.dir);
    const absolute = path.resolve(root, resource.artifactPath);
    if (!absolute.startsWith(`${root}${path.sep}`)) {
      throw new ForbiddenError('Invalid artifact path');
    }
    const buffer = await fs.readFile(absolute);
    return {
      buffer,
      mime: resource.mime ?? 'application/octet-stream',
      fileName: `${resource.kind}-${resource.batchId}${path.extname(resource.artifactPath)}`,
    };
  }

  async function removeMine(user, resourceId) {
    const resource = await generatedResourceRepository.findById(resourceId);
    if (!resource || String(resource.userId) !== String(user.id)) {
      throw new NotFoundError('Resource not found');
    }
    if (resource.artifactPath) {
      const root = path.resolve(config.artifacts.dir);
      const absolute = path.resolve(root, resource.artifactPath);
      if (absolute.startsWith(`${root}${path.sep}`)) {
        await fs.rm(absolute, { force: true });
      }
    }
    await generatedResourceRepository.deleteById(resource._id);
    return { id: String(resource._id), deleted: true };
  }

  return { generate, listMine, downloadArtifact, removeMine };
}

export function createLearningResourceRepositoryAdapter(repository) {
  return repository;
}
