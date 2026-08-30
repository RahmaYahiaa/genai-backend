import PracticeSession from './practice-session.model.js';
import * as practiceRepository from './practice-session.repository.js';
import { authenticate } from '../auth/index.js';
import { coursesService } from '../courses/index.js';
import { evidenceRepository } from '../learner/index.js';
import { llmProvider } from '../../ai/llm/index.js';
import { createPracticeService } from './practice.service.js';
import { createPracticeController } from './practice.controller.js';
import { createPracticeRouter } from './practice.routes.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import {
  courseIdParamSchema,
  practiceSessionIdParamSchema,
  createPracticeSessionSchema,
  submitPracticeAnswerSchema,
} from './practice.schema.js';

export { PracticeSession as practiceSessionModel };
export { practiceRepository };

// Composition root (manual DI): repositories + cross-module services (courses
// access + learner evidence) + LLM provider -> practice service -> router.
export const practiceService = createPracticeService({
  coursesService,
  practiceRepository,
  evidenceRepository,
  llmProvider,
});

const controller = createPracticeController({ practiceService });

export const practiceRouter = createPracticeRouter({
  controller,
  middlewares: { authenticate },
  validators: {
    courseIdParam: validateSchemas({ params: courseIdParamSchema }),
    practiceSessionIdParam: validateSchemas({ params: practiceSessionIdParamSchema }),
    createSession: validateSchemas({ body: createPracticeSessionSchema }),
    submitAnswer: validateSchemas({ body: submitPracticeAnswerSchema }),
  },
});