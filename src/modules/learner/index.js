import LearnerProfile from './learner-profile.model.js';
import DiagnosticAssessment from './diagnostic-assessment.model.js';
import LearningEvidence from './learning-evidence.model.js';
import * as learnerRepository from './learner.repository.js';
import * as diagnosticRepository from './diagnostic.repository.js';
import * as evidenceRepository from './evidence.repository.js';
import { authenticate } from '../auth/index.js';
import { coursesService } from '../courses/index.js';
import { llmProvider } from '../../ai/llm/index.js';
import { transcriptionProvider } from '../../ai/transcription/index.js';
import { createLearnerDiagnosticService } from './learner-diagnostic.service.js';
import { createLearnerDiagnosticController } from './learner-diagnostic.controller.js';
import { createLearnerDiagnosticRouter } from './learner-diagnostic.routes.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import {
  courseIdParamSchema,
  diagnosticIdParamSchema,
  startDiagnosticSchema,
  submitAnswerSchema,
} from './learner-diagnostic.schema.js';

export {
  LearnerProfile as learnerProfileModel,
  DiagnosticAssessment as diagnosticAssessmentModel,
  LearningEvidence as learningEvidenceModel,
};
export { learnerRepository, diagnosticRepository, evidenceRepository };

// Composition root (manual DI): repositories + cross-module services + AI
// providers (LLM + transcription) -> learning-flow service -> router.
export const learnerDiagnosticService = createLearnerDiagnosticService({
  learnerRepository,
  diagnosticRepository,
  evidenceRepository,
  coursesService,
  llmProvider,
  transcriptionProvider,
});

const controller = createLearnerDiagnosticController({ learnerDiagnosticService });

export const learnerDiagnosticRouter = createLearnerDiagnosticRouter({
  controller,
  middlewares: { authenticate },
  validators: {
    courseIdParam: validateSchemas({ params: courseIdParamSchema }),
    diagnosticIdParam: validateSchemas({ params: diagnosticIdParamSchema }),
    startDiagnostic: validateSchemas({ body: startDiagnosticSchema }),
    submitAnswer: validateSchemas({ body: submitAnswerSchema }),
  },
});