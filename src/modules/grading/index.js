import AiEvaluation from './ai-evaluation.model.js';
import * as aiEvaluationRepository from './ai-evaluation.repository.js';
import { authenticate } from '../auth/index.js';
import { coursesService } from '../courses/index.js';
import { retrievalService } from '../retrieval/index.js';
import { llmProvider } from '../../ai/llm/index.js';
import * as assignmentRepository from '../assignments/assignment.repository.js';
import * as assignmentQuestionRepository from '../assignments/assignment-question.repository.js';
import * as submissionRepository from '../submissions/submission.repository.js';
import * as submissionAttemptRepository from '../submissions/submission-attempt.repository.js';
import * as submissionAnswerRepository from '../submissions/submission-answer.repository.js';
import * as courseRepository from '../courses/course.repository.js';
import { logger } from '../../config/logger.js';
import { createGradingService } from './grading.service.js';
import { assessmentEngine } from '../assessment-engine/assessment-engine.service.js';
import { createGradingQueue } from './grading-queue.js';
import { createGradingController } from './grading.controller.js';
import { createGradingRouter } from './grading.routes.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import {
  previewEvaluationSchema,
  submissionIdParamSchema,
  previewQuestionParamSchema,
} from './grading.schema.js';

export { AiEvaluation as aiEvaluationModel };
export { aiEvaluationRepository };

export const gradingService = createGradingService({
  coursesService,
  aiEvaluationRepository,
  assignmentRepository,
  assignmentQuestionRepository,
  submissionRepository,
  submissionAttemptRepository,
  submissionAnswerRepository,
  courseRepository,
  retrievalService,
  llmProvider,
  assessmentEngine,
});

export const gradingQueue = createGradingQueue({ gradingService, logger });

const controller = createGradingController({ gradingService });

export const gradingRouter = createGradingRouter({
  controller,
  middlewares: { authenticate },
  validators: {
    previewQuestionParam: validateSchemas({ params: previewQuestionParamSchema }),
    previewEvaluation: validateSchemas({ body: previewEvaluationSchema }),
    submissionIdParam: validateSchemas({ params: submissionIdParamSchema }),
  },
});