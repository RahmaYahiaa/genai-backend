import ReassessmentSession from './reassessment-session.model.js';
import * as reassessmentRepository from './reassessment-session.repository.js';
import { authenticate } from '../auth/index.js';
import { coursesService } from '../courses/index.js';
import { evidenceRepository } from '../learner/index.js';
import { llmProvider } from '../../ai/llm/index.js';
import { createReassessmentService } from './reassessment.service.js';
import { createReassessmentController } from './reassessment.controller.js';
import { createReassessmentRouter } from './reassessment.routes.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import {
  courseIdParamSchema,
  reassessmentIdParamSchema,
  createReassessmentSchema,
  submitReassessmentAnswerSchema,
} from './reassessment.schema.js';

export { ReassessmentSession as reassessmentSessionModel };
export { reassessmentRepository };

// Composition root (manual DI): repositories + cross-module services (courses
// access + learner evidence) + LLM provider -> reassessment service -> router.
export const reassessmentService = createReassessmentService({
  coursesService,
  reassessmentRepository,
  evidenceRepository,
  llmProvider,
});

const controller = createReassessmentController({ reassessmentService });

export const reassessmentRouter = createReassessmentRouter({
  controller,
  middlewares: { authenticate },
  validators: {
    courseIdParam: validateSchemas({ params: courseIdParamSchema }),
    reassessmentIdParam: validateSchemas({ params: reassessmentIdParamSchema }),
    createSession: validateSchemas({ body: createReassessmentSchema }),
    submitAnswer: validateSchemas({ body: submitReassessmentAnswerSchema }),
  },
});