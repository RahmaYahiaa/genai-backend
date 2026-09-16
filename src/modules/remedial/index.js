import RemedialContent from './remedial.model.js';
import * as remedialRepository from './remedial.repository.js';
import { authenticate } from '../auth/index.js';
import { coursesService, enrollmentRepository } from '../courses/index.js';
import * as courseRepository from '../courses/course.repository.js';
import * as assignmentRepository from '../assignments/assignment.repository.js';
import { aiEvaluationRepository } from '../grading/index.js';
import { retrievalService } from '../retrieval/index.js';
import { llmProvider } from '../../ai/llm/index.js';
import { createRemedialService } from './remedial.service.js';
import { createRemedialController } from './remedial.controller.js';
import { createRemedialRouter } from './remedial.routes.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import {
  courseIdParamSchema,
  remedialIdParamSchema,
  listRemedialQuerySchema,
  generateRemedialSchema,
  updateDraftSchema,
  publishRemedialSchema,
} from './remedial.schema.js';

export { RemedialContent as remedialContentModel };
export { remedialRepository };

export const remedialService = createRemedialService({
  coursesService,
  courseRepository,
  enrollmentRepository,
  assignmentRepository,
  aiEvaluationRepository,
  remedialRepository,
  retrievalService,
  llmProvider,
});

const controller = createRemedialController({ remedialService });

export const remedialRouter = createRemedialRouter({
  controller,
  middlewares: { authenticate },
  validators: {
    courseIdParam: validateSchemas({ params: courseIdParamSchema }),
    remedialIdParam: validateSchemas({ params: remedialIdParamSchema }),
    listQuery: validateSchemas({ query: listRemedialQuerySchema }),
    generate: validateSchemas({ body: generateRemedialSchema }),
    updateDraft: validateSchemas({ body: updateDraftSchema }),
    publish: validateSchemas({ body: publishRemedialSchema }),
  },
});