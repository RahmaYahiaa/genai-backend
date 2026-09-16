import {
  ERROR_CODES,
  ROLES,
  REMEDIAL_ORIGINS,
  REMEDIAL_STATUSES,
  REMEDIAL_AUDIENCE_TYPES,
  REMEDIAL_PROMPT_VERSION,
} from '../../config/constants.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from '../../shared/errors/index.js';
import {
  toPublicRemedial,
  toPublicRemedialForStudent,
} from './remedial.model.js';
import { remedialOutputSchema } from './remedial.schema.js';

const GENERATION_ATTEMPTS = 2;

function isValidObjectId(value) {
  return /^[0-9a-f]{24}$/i.test(String(value ?? ''));
}

export function createRemedialService({
  coursesService,
  courseRepository,
  enrollmentRepository,
  assignmentRepository,
  aiEvaluationRepository,
  remedialRepository,
  retrievalService,
  llmProvider,
}) {
  async function getCourseForInstructor(user, courseId) {
    await coursesService.ensureInstructorCourseAccess(user, courseId);
    const course = await courseRepository.findById(courseId);
    if (!course) {
      throw new NotFoundError('Course not found');
    }
    return course;
  }

  function topicTitleFromCourse(course, topicId) {
    const topic = (course.topics ?? []).find(
      (entry) => String(entry._id) === String(topicId),
    );
    return topic ? topic.title : null;
  }

  async function resolveMisconceptionContext(course, payload) {
    const assignment = await assignmentRepository.findById(payload.assignmentId);
    if (!assignment || String(assignment.courseId) !== String(course._id)) {
      throw new UnprocessableEntityError('assignmentId does not belong to this course');
    }
    const evaluations = await aiEvaluationRepository.listByAssignment(assignment._id);
    const matching = evaluations.filter((evaluation) =>
      (evaluation.misconceptions ?? []).some(
        (misconception) => misconception.code === payload.misconceptionCode,
      ),
    );
    if (matching.length === 0) {
      throw new UnprocessableEntityError(
        'No AI evaluation reported this misconception code for this assignment',
      );
    }
    const first = matching
      .flatMap((evaluation) => evaluation.misconceptions)
      .find((misconception) => misconception.code === payload.misconceptionCode);
    const affectedStudentIds = Array.from(
      new Set(matching.map((evaluation) => evaluation.studentId.toString())),
    );
    const topicId = matching[0].topicId ? matching[0].topicId.toString() : null;
    return {
      assignmentId: assignment._id.toString(),
      topicId,
      topicTitle: topicId ? topicTitleFromCourse(course, topicId) : null,
      misconception: { code: first.code, description: first.description },
      affectedStudentIds,
    };
  }

  function resolveStandaloneContext(course, payload) {
    if (!isValidObjectId(payload.topicId)) {
      throw new UnprocessableEntityError('topicId is not a valid identifier');
    }
    const topicTitle = topicTitleFromCourse(course, payload.topicId);
    if (!topicTitle) {
      throw new UnprocessableEntityError('topicId does not belong to this course');
    }
    return {
      assignmentId: null,
      topicId: payload.topicId.toString(),
      topicTitle,
      misconception: null,
      affectedStudentIds: [],
    };
  }

  async function generateDraft(user, courseId, payload) {
    const course = await getCourseForInstructor(user, courseId);
    const context =
      payload.origin === REMEDIAL_ORIGINS.FROM_MISCONCEPTION
        ? await resolveMisconceptionContext(course, payload)
        : resolveStandaloneContext(course, payload);

    const query = context.misconception
      ? `${context.topicTitle ?? ''} ${context.misconception.description}`.trim()
      : `${context.topicTitle} ${payload.instructions ?? ''}`.trim();
    const { contexts } = await retrievalService.retrieveContext({
      courseId: course._id,
      query,
    });
    if (contexts.length === 0) {
      throw new AppError({
        statusCode: 422,
        code: ERROR_CODES.INSUFFICIENT_EVIDENCE,
        message: 'No trusted course material is available to ground this remedial content',
      });
    }

    let output = null;
    let lastError = null;
    for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt += 1) {
      try {
        const raw = await llmProvider.completeJson({
          task: 'generate_remedial_content',
          payload: {
            origin: payload.origin,
            contentType: payload.contentType,
            topicTitle: context.topicTitle,
            misconception: context.misconception,
            instructions: payload.instructions ?? null,
            excerpts: contexts.map((contextEntry) => ({
              id: contextEntry.chunkId,
              text: contextEntry.snippet,
            })),
          },
        });
        output = remedialOutputSchema.parse(raw);
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!output) {
      throw new AppError({
        statusCode: 502,
        code: ERROR_CODES.AI_PROVIDER_ERROR,
        message: 'The remedial content model failed to produce valid output',
        details: lastError?.message ?? null,
      });
    }

    const document = await remedialRepository.create({
      courseId: course._id,
      assignmentId: context.assignmentId,
      topicId: context.topicId,
      origin: payload.origin,
      contentType: payload.contentType,
      misconceptionCode: context.misconception?.code ?? null,
      misconceptionDescription: context.misconception?.description ?? null,
      title: output.title,
      body: output.body,
      status: REMEDIAL_STATUSES.DRAFT,
      createdBy: user.id,
      sourcesUsed: {
        retrievedChunks: contexts.length,
        chunkIds: contexts.map((contextEntry) => contextEntry.chunkId),
      },
      modelVersion: llmProvider.model,
      promptVersion: REMEDIAL_PROMPT_VERSION,
    });
    return { ...toPublicRemedial(document), affectedStudentIds: context.affectedStudentIds };
  }

  async function listCourseRemedial(user, courseId, query) {
    await getCourseForInstructor(user, courseId);
    const { items, total } = await remedialRepository.listByCourse(courseId, {
      status: query.status ?? null,
      skip: 0,
      limit: 0,
    });
    return { items: items.map(toPublicRemedial), total };
  }

  async function getRemedialDocument(user, courseId, remedialId) {
    await getCourseForInstructor(user, courseId);
    const document = await remedialRepository.findById(remedialId);
    if (!document || String(document.courseId) !== String(courseId)) {
      throw new NotFoundError('Remedial content not found');
    }
    return document;
  }

  async function getRemedial(user, courseId, remedialId) {
    const document = await getRemedialDocument(user, courseId, remedialId);
    return toPublicRemedial(document);
  }

  async function updateDraft(user, courseId, remedialId, payload) {
    const document = await getRemedialDocument(user, courseId, remedialId);
    if (document.status !== REMEDIAL_STATUSES.DRAFT) {
      throw new ConflictError('Only draft remedial content can be edited');
    }
    const update = {};
    if (payload.title !== undefined) update.title = payload.title;
    if (payload.body !== undefined) update.body = payload.body;
    const updated = await remedialRepository.updateById(remedialId, update);
    return toPublicRemedial(updated);
  }

  async function publishRemedial(user, courseId, remedialId, payload) {
    const document = await getRemedialDocument(user, courseId, remedialId);
    if (document.status !== REMEDIAL_STATUSES.DRAFT) {
      throw new ConflictError('Remedial content is already published');
    }

    let audienceStudentIds = [];
    if (payload.audienceType === REMEDIAL_AUDIENCE_TYPES.SELECTED_STUDENTS) {
      for (const studentId of payload.studentIds) {
        const enrolled = await enrollmentRepository.exists(studentId, courseId);
        if (!enrolled) {
          throw new UnprocessableEntityError(
            `student ${studentId} is not enrolled in this course`,
          );
        }
      }
      audienceStudentIds = payload.studentIds;
    } else if (payload.audienceType === REMEDIAL_AUDIENCE_TYPES.AFFECTED_STUDENTS) {
      if (
        document.origin !== REMEDIAL_ORIGINS.FROM_MISCONCEPTION ||
        !document.assignmentId ||
        !document.misconceptionCode
      ) {
        throw new UnprocessableEntityError(
          'AFFECTED_STUDENTS audience requires misconception-sourced content',
        );
      }
      const evaluations = await aiEvaluationRepository.listByAssignment(document.assignmentId);
      audienceStudentIds = Array.from(
        new Set(
          evaluations
            .filter((evaluation) =>
              (evaluation.misconceptions ?? []).some(
                (misconception) => misconception.code === document.misconceptionCode,
              ),
            )
            .map((evaluation) => evaluation.studentId.toString()),
        ),
      );
      if (audienceStudentIds.length === 0) {
        throw new UnprocessableEntityError('No affected students were found for this misconception');
      }
    }

    const updated = await remedialRepository.updateById(remedialId, {
      status: REMEDIAL_STATUSES.PUBLISHED,
      publishedAt: new Date(),
      publishedBy: user.id,
      audienceType: payload.audienceType,
      audienceStudentIds,
    });
    return toPublicRemedial(updated);
  }

  async function listMyRemedial(user, courseId) {
    if (user.role !== ROLES.STUDENT) {
      throw new ForbiddenError('Only students can list their remedial content');
    }
    await coursesService.ensureInstitutionalCourseAccess(user, courseId);
    const enrolled = await enrollmentRepository.exists(user.id, courseId);
    if (!enrolled) {
      throw new NotFoundError('Course not found');
    }
    const documents = await remedialRepository.listPublishedForStudent(courseId, user.id);
    return { items: documents.map(toPublicRemedialForStudent) };
  }

  return {
    generateDraft,
    listCourseRemedial,
    getRemedial,
    updateDraft,
    publishRemedial,
    listMyRemedial,
  };
}