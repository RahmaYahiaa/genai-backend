import { Router } from 'express';
import { z } from 'zod';
import Course from '../courses/course.model.js';
import Material from '../knowledge/material.model.js';
import MaterialChunk from '../knowledge/material-chunk.model.js';
import LearningEvidence from '../learner/learning-evidence.model.js';
import { llmProvider } from '../../ai/llm/index.js';
import { embeddingProvider } from '../../ai/embeddings/index.js';
import { authenticate } from '../auth/index.js';
import { coursesService } from '../courses/index.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess } from '../../shared/http/api-response.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import { objectIdField } from '../academic-structure/academic-structure.schema.js';
import { createTopicDetectionService } from './topic-detection.service.js';
import { domainEvents } from '../analytics/index.js';
import { logger } from '../../config/logger.js';

export const topicDetectionService = createTopicDetectionService({
  Course,
  Material,
  MaterialChunk,
  llmProvider,
  embeddingProvider,
  LearningEvidence,
});

// Staff-only topic maintenance. Topics are created by the AI from the course
// files; staff may re-run detection or merge two topics the AI split.
// (Rename/delete reuse the existing course topic routes.)
const courseParam = validateSchemas({ params: z.object({ courseId: objectIdField('courseId') }) });
const mergeBody = validateSchemas({
  body: z.object({ fromTopicId: objectIdField('fromTopicId'), intoTopicId: objectIdField('intoTopicId') }),
});

export const topicsRouter = Router();
topicsRouter.use(authenticate);
topicsRouter.post(
  '/courses/:courseId/topics/detect',
  courseParam,
  asyncHandler(async (req, res) => {
    await coursesService.ensureCourseWriteAccess(req.user, req.validated.params.courseId);
    const results = await topicDetectionService.detectPending(req.validated.params.courseId);
    sendSuccess(res, { data: { results } });
  }),
);
topicsRouter.post(
  '/courses/:courseId/topics/merge',
  courseParam,
  mergeBody,
  asyncHandler(async (req, res) => {
    await coursesService.ensureCourseWriteAccess(req.user, req.validated.params.courseId);
    const { fromTopicId, intoTopicId } = req.validated.body;
    const data = await topicDetectionService.mergeTopics(req.validated.params.courseId, fromTopicId, intoTopicId);
    sendSuccess(res, { data });
  }),
);

// Every file that becomes ready is read by the AI in the background.
domainEvents.on('MaterialsUploaded', (event) => {
  if (!event?.materialId) return;
  topicDetectionService
    .detectForMaterial(event.materialId, { sectionTexts: event.sectionTexts ?? null })
    .catch((error) => logger.warn({ err: error.message }, 'Topic detection crashed'));
});
