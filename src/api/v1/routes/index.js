import { Router } from 'express';
import healthRoutes from './health.routes.js';
import { authRouter } from '../../../modules/auth/index.js';
import { academicStructureRouter } from '../../../modules/academic-structure/index.js';
import { coursesRouter } from '../../../modules/courses/index.js';
import { knowledgeIngestionRouter } from '../../../modules/knowledge/index.js';
import { learnerDiagnosticRouter } from '../../../modules/learner/index.js';
import { tutorRouter } from '../../../modules/tutor/index.js';
import { practiceRouter } from '../../../modules/practice/index.js';
import { reassessmentRouter } from '../../../modules/reassessment/index.js';
import { assignmentsRouter } from '../../../modules/assignments/index.js';
import { submissionsRouter } from '../../../modules/submissions/index.js';
import { gradingRouter } from '../../../modules/grading/index.js';
import { reviewRouter } from '../../../modules/review/index.js';
import { remedialRouter } from '../../../modules/remedial/index.js';

const router = Router();

router.use(healthRoutes);
router.use('/auth', authRouter);
// Handles /institutions/* and /units/* routes internally.
router.use(academicStructureRouter);
router.use('/courses', coursesRouter);
// Handles /courses/:courseId/materials/* routes internally (knowledge module).
router.use(knowledgeIngestionRouter);
// Handles /courses/:courseId/learner-profile and /diagnostics/* routes
// internally (learner module).
router.use(learnerDiagnosticRouter);
// Handles /courses/:courseId/tutor/* routes internally (AI tutor module).
router.use(tutorRouter);
// Handles /courses/:courseId/practice/* routes internally (practice module).
router.use(practiceRouter);
// Handles /courses/:courseId/reassessments/* and /learning-gain routes
// internally (reassessment module).
router.use(reassessmentRouter);

// Handles /courses/:courseId/assignments/* and /assignments/* routes
// internally (assignments module).
router.use(assignmentsRouter);

// Handles /assignments/:assignmentId/answers/* and /submit routes internally
// (submissions module - the student side of assignments).
router.use(submissionsRouter);

// Handles preview-evaluation and /submissions/:id review reads
// (grading module - the shared AI grading pipeline).
router.use(gradingRouter);

// Handles /assignments/:id/review, common-mistakes, bulk-approve and the
// four /submissions/:id decision actions (review module - instructor
// approval workflow with the audit trail).
router.use(reviewRouter);

// Handles /courses/:courseId/remedial/* routes internally (remedial module -
// instructor-authored remedial content with a draft-then-publish workflow).
router.use(remedialRouter);

// Feature module routers (diagnostics, tutor, ...) are mounted here
// by their module composition roots as each module is implemented.

export default router;