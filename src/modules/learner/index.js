import { Router } from 'express';
import LearnerProfile from './learner-profile.model.js';
import User from '../auth/user.model.js';
import Enrollment from '../courses/enrollment.model.js';
import Course from '../courses/course.model.js';
import { ROLES } from '../../config/constants.js';
import { config } from '../../config/index.js';
import { lernaService } from '../lerna/index.js';
import { buildLocalLearningState } from '../lerna/local-learning.js';
import { sendSuccess } from '../../shared/http/api-response.js';
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
import { createLearnerModelService } from './learner-model.service.js';
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

// Deterministic learner model (mastery/gaps/next action) - zero ML by design.
export const learnerModelService = createLearnerModelService({
  coursesService,
  evidenceRepository,
  diagnosticRepository,
});

const controller = createLearnerDiagnosticController({
  learnerDiagnosticService,
  learnerModelService,
});

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
// ── Public, read-only demo mastery for the login page ladder ─────────────────
// Exposes ONLY the topic mastery of the seeded demo student in the demo course.
// No auth, no writes. Derived from real learning evidence via the learner model.
const DEMO_STUDENT_EMAIL = 'sara.mitchell@gmail.com';
const DEMO_COURSE_CODE = 'CS301';

export const publicDemoMasteryRouter = Router();

publicDemoMasteryRouter.get('/public/demo-mastery', async (req, res, next) => {
  try {
    const student = await User.findOne({ email: DEMO_STUDENT_EMAIL, role: ROLES.STUDENT })
      .select('_id')
      .lean();
    if (!student) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Demo data not found' } });

    const enrollments = await Enrollment.find({ studentId: student._id }).select('courseId').lean();
    const course = await Course.findOne({
      _id: { $in: enrollments.map((row) => row.courseId) },
      code: DEMO_COURSE_CODE,
    })
      .select('_id code title')
      .lean();
    if (!course) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Demo data not found' } });

    // Same source as the student's "My Progress" (GET /students/me/learning): the AI engine's
    // mastery when it has any, otherwise the platform's own evidence. Values are keyed by title.
    let learning = null;
    if (config.lerna.enabled) {
      learning = await lernaService.getLearningState({ id: String(student._id), role: ROLES.STUDENT }).catch(() => null);
    }
    if (Object.keys(learning?.profile?.concept_mastery ?? {}).length === 0) {
      learning = await buildLocalLearningState({ id: String(student._id), role: ROLES.STUDENT });
    }
    const conceptMastery = learning?.profile?.concept_mastery ?? {};

    // Topic list and evidence counts come from the course's learner model.
    const model = await learnerModelService.getLearnerModel(
      { id: String(student._id), role: ROLES.STUDENT },
      String(course._id),
    );
    const topics = model.mastery.map((item) => {
      const value = Number(conceptMastery[item.title] ?? 0);
      return {
        id: item.topicId,
        label: { en: item.title },
        pct: Math.round(value * 100),
        evidence: item.evidenceCount,
      };
    });
    const overall = topics.length
      ? Math.round(topics.reduce((sum, topic) => sum + topic.pct, 0) / topics.length)
      : 0;

    // Public and mostly static: let browsers and proxies reuse it for a few minutes.
    res.set('Cache-Control', 'public, max-age=300');
    return sendSuccess(res, {
      data: { courseCode: course.code, courseTitle: course.title, overall, topics },
    });
  } catch (error) {
    return next(error);
  }
});
