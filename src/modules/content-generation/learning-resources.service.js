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

const TEXT_KINDS = ['summary', 'notes', 'flashcards', 'quiz', 'code'];
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
};

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

  function languageLine(language) {
    return language === 'ar'
      ? 'Write ALL user-facing text in Arabic (Modern Standard), keeping technical terms and code in English where standard.'
      : 'Write in clear academic English.';
  }

  async function generateTextKind(kind, { topic, language, focus, evidenceText }) {
    const system =
      'You generate study resources for an academic learning platform. Ground the content in the provided evidence when it is present; ' +
      'when no evidence is provided, produce standard, accurate academic study material without fabricating citations or sources. ' +
      languageLine(language) +
      (focus.length > 0
        ? ` Prioritize these learner weak points: ${focus.join(', ')}.`
        : '') +
      ' Respond with JSON only.';
    const user = JSON.stringify({
      topic,
      resource: KIND_INSTRUCTIONS[kind],
      evidence: evidenceText || null,
    });
    const raw = await llmProvider.completeJson({
      task: `generate_${kind}`,
      system,
      user,
    });
    const parsed = llmTextResourceSchemas[kind].safeParse(raw);
    if (!parsed.success) {
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
    const batchId = crypto.randomUUID().slice(0, 8);
    const focus = await learnerFocus(user, docCourseId);
    const results = [];

    // LeRna (Academic OS) is the AI source of truth once enabled: the whole
    // 15-kind generation contract runs there; media kinds remain an honest
    // client-side `unavailable` (LeRna has no real media provider either).
    if (config.lerna.enabled && lernaService?.isReady?.()) {
      return generateViaLerna(user, course, data, batchId, results);
    }

    for (const kind of data.kinds) {
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
          const { knowledgeSource, evidenceText } = await gatherEvidence(docCourseId, data.topic);
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
      results.push(toPublicResource(doc));
    }
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

  return { generate, listMine, downloadArtifact };
}

export function createLearningResourceRepositoryAdapter(repository) {
  return repository;
}
