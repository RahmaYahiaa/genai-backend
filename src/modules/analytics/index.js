import AnalyticsSnapshot, { toPublicAnalyticsSnapshot } from './analytics.model.js';
import * as analyticsRepository from './analytics.repository.js';
import { createDomainEvents, createAnalyticsScheduler } from './domain-events.js';
import { authenticate } from '../auth/index.js';
import { coursesService } from '../courses/index.js';
import * as courseRepository from '../courses/course.repository.js';
import * as assignmentRepository from '../assignments/assignment.repository.js';
import * as assignmentQuestionRepository from '../assignments/assignment-question.repository.js';
import * as submissionRepository from '../submissions/submission.repository.js';
import * as submissionAttemptRepository from '../submissions/submission-attempt.repository.js';
import * as submissionAnswerRepository from '../submissions/submission-answer.repository.js';
import * as aiEvaluationRepository from '../grading/ai-evaluation.repository.js';
import * as finalGradeRepository from '../review/final-grade.repository.js';
import * as materialRepository from '../knowledge/material.repository.js';
import * as evidenceRepository from '../learner/evidence.repository.js';
import { logger } from '../../config/logger.js';
import { createAssignmentEvidenceService } from './assignment-evidence.service.js';
import { createAnalyticsService } from './analytics.service.js';
import { createAnalyticsController } from './analytics.controller.js';
import { createAnalyticsRouter } from './analytics.routes.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import { analyticsCourseIdParamSchema } from './analytics.schema.js';

export { AnalyticsSnapshot as analyticsSnapshotModel };
export { analyticsRepository, toPublicAnalyticsSnapshot };

// In-process domain events shared by every module (fixed stack, no broker).
export const domainEvents = createDomainEvents();

export const assignmentEvidenceService = createAssignmentEvidenceService({
  courseRepository,
  assignmentQuestionRepository,
  submissionAttemptRepository,
  submissionAnswerRepository,
  finalGradeRepository,
  aiEvaluationRepository,
  evidenceRepository,
});

export const analyticsService = createAnalyticsService({
  coursesService,
  courseRepository,
  assignmentRepository,
  assignmentQuestionRepository,
  submissionRepository,
  submissionAttemptRepository,
  submissionAnswerRepository,
  aiEvaluationRepository,
  materialRepository,
  evidenceRepository,
  analyticsRepository,
  domainEvents,
});

export const analyticsScheduler = createAnalyticsScheduler({
  recomputeCourse: (courseId) => analyticsService.recomputeCourse(courseId),
  logger,
});

domainEvents.on('SubmissionFinalized', (event) => analyticsScheduler.schedule(event.courseId));
domainEvents.on('LearningEvidenceCreated', (event) => analyticsScheduler.schedule(event.courseId));
domainEvents.on('MaterialsUploaded', (event) => analyticsScheduler.schedule(event.courseId));
domainEvents.on('AssignmentClosed', (event) => analyticsScheduler.schedule(event.courseId));
domainEvents.on('AnalyticsSnapshotMissing', (event) => analyticsScheduler.schedule(event.courseId));

const controller = createAnalyticsController({ analyticsService });

export const analyticsRouter = createAnalyticsRouter({
  controller,
  middlewares: { authenticate },
  validators: {
    courseIdParam: validateSchemas({ params: analyticsCourseIdParamSchema }),
  },
});