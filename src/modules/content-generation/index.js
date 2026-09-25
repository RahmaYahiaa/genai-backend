import GeneratedResource from './generated-resource.model.js';
import * as generatedResourceRepository from './generated-resource.repository.js';
import { authenticate } from '../auth/index.js';
import { coursesService } from '../courses/index.js';
import { retrievalService } from '../retrieval/index.js';
import { learnerModelService } from '../learner/index.js';
import { llmProvider } from '../../ai/llm/index.js';
import { createLearningResourcesService } from './learning-resources.service.js';
import { createLearningResourcesController } from './learning-resources.controller.js';
import { createLearningResourcesRouter } from './learning-resources.routes.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import {
  courseIdParamSchema,
  generateResourcesSchema,
  listResourcesQuerySchema,
  resourceIdParamSchema,
} from './learning-resources.schema.js';
import { lernaService } from '../lerna/index.js';

export { GeneratedResource as generatedResourceModel };
export { generatedResourceRepository };

// Composition root (manual DI): course access + retrieval evidence + learner
// profile targeting + LLM provider -> generation service -> controller.
export const learningResourcesService = createLearningResourcesService({
  coursesService,
  retrievalService,
  generatedResourceRepository,
  llmProvider,
  learnerModelService,
  lernaService,
});

const controller = createLearningResourcesController({ learningResourcesService });

export const learningResourcesRouter = createLearningResourcesRouter({
  controller,
  middlewares: { authenticate },
  validators: {
    courseIdParam: validateSchemas({ params: courseIdParamSchema }),
    resourceIdParam: validateSchemas({ params: resourceIdParamSchema }),
    generate: validateSchemas({ body: generateResourcesSchema }),
    listQuery: validateSchemas({ query: listResourcesQuerySchema }),
  },
});
