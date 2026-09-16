import FinalGrade from './final-grade.model.js';
import * as finalGradeRepository from './final-grade.repository.js';
import { authenticate } from '../auth/index.js';
import { coursesService } from '../courses/index.js';
import { authService } from '../auth/index.js';
import { auditService } from '../audit/index.js';
import * as assignmentRepository from '../assignments/assignment.repository.js';
import * as assignmentQuestionRepository from '../assignments/assignment-question.repository.js';
import * as submissionRepository from '../submissions/submission.repository.js';
import * as submissionAttemptRepository from '../submissions/submission-attempt.repository.js';
import * as submissionAnswerRepository from '../submissions/submission-answer.repository.js';
import { aiEvaluationRepository } from '../grading/index.js';
import { createReviewService } from './review.service.js';
import { createReviewController } from './review.controller.js';
import { createReviewRouter } from './review.routes.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import {
  assignmentIdParamSchema,
  submissionIdParamSchema,
  reviewQuerySchema,
  bulkApproveSchema,
  decisionScoreSchema,
  requestResubmissionSchema,
} from './review.schema.js';

export { FinalGrade as finalGradeModel };
export { finalGradeRepository };

export const reviewService = createReviewService({
  coursesService,
  auditService,
  authService,
  assignmentRepository,
  assignmentQuestionRepository,
  submissionRepository,
  submissionAttemptRepository,
  submissionAnswerRepository,
  aiEvaluationRepository,
  finalGradeRepository,
});

const controller = createReviewController({ reviewService });

export const reviewRouter = createReviewRouter({
  controller,
  middlewares: { authenticate },
  validators: {
    assignmentIdParam: validateSchemas({ params: assignmentIdParamSchema }),
    submissionIdParam: validateSchemas({ params: submissionIdParamSchema }),
    reviewQuery: validateSchemas({ query: reviewQuerySchema }),
    bulkApprove: validateSchemas({ body: bulkApproveSchema }),
    decisionScore: validateSchemas({ body: decisionScoreSchema }),
    requestResubmission: validateSchemas({ body: requestResubmissionSchema }),
  },
});