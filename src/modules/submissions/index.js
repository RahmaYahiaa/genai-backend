import * as submissionRepository from './submission.repository.js';
import * as submissionAttemptRepository from './submission-attempt.repository.js';
import * as submissionAnswerRepository from './submission-answer.repository.js';
import * as assignmentRepository from '../assignments/assignment.repository.js';
import * as assignmentQuestionRepository from '../assignments/assignment-question.repository.js';
import { authenticate } from '../auth/index.js';
import { coursesService, enrollmentRepository } from '../courses/index.js';
import { gradingQueue } from '../grading/index.js';
import * as finalGradeRepository from '../review/final-grade.repository.js';
import { createSubmissionsService } from './submissions.service.js';
import { createSubmissionsController } from './submissions.controller.js';
import { createSubmissionsRouter } from './submissions.routes.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import {
  assignmentIdParamSchema,
  answerParamSchema,
  autosaveAnswerSchema,
} from './submissions.schema.js';

export { submissionRepository, submissionAttemptRepository, submissionAnswerRepository };

export const submissionsService = createSubmissionsService({
  submissionRepository,
  submissionAttemptRepository,
  submissionAnswerRepository,
  assignmentRepository,
  assignmentQuestionRepository,
  coursesService,
  enrollmentRepository,
  gradingQueue,
  finalGradeRepository,
});

const controller = createSubmissionsController({ submissionsService });

export const submissionsRouter = createSubmissionsRouter({
  controller,
  middlewares: { authenticate },
  validators: {
    assignmentIdParam: validateSchemas({ params: assignmentIdParamSchema }),
    answerParam: validateSchemas({ params: answerParamSchema }),
    autosaveAnswer: validateSchemas({ body: autosaveAnswerSchema }),
  },
});