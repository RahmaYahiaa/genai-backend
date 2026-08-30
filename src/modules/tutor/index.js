import TutorSession from './tutor-session.model.js';
import * as tutorSessionRepository from './tutor-session.repository.js';
import { authenticate } from '../auth/index.js';
import { coursesService } from '../courses/index.js';
import { retrievalService } from '../retrieval/index.js';
import { llmProvider } from '../../ai/llm/index.js';
import { createTutorService } from './tutor.service.js';
import { createTutorController } from './tutor.controller.js';
import { createTutorRouter } from './tutor.routes.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import {
  courseIdParamSchema,
  tutorSessionIdParamSchema,
  createTutorSessionSchema,
  sendTutorMessageSchema,
} from './tutor.schema.js';

export { TutorSession as tutorSessionModel };
export { tutorSessionRepository };

// Composition root (manual DI): repositories + retrieval (RAG) + cross-module
// services + LLM provider -> tutor service -> controller -> router.
export const tutorService = createTutorService({
  coursesService,
  retrievalService,
  tutorSessionRepository,
  llmProvider,
});

const controller = createTutorController({ tutorService });

export const tutorRouter = createTutorRouter({
  controller,
  middlewares: { authenticate },
  validators: {
    courseIdParam: validateSchemas({ params: courseIdParamSchema }),
    tutorSessionIdParam: validateSchemas({ params: tutorSessionIdParamSchema }),
    createSession: validateSchemas({ body: createTutorSessionSchema }),
    sendMessage: validateSchemas({ body: sendTutorMessageSchema }),
  },
});