import { Router } from 'express';
import healthRoutes from './health.routes.js';
import { authRouter } from '../../../modules/auth/index.js';
import { academicStructureRouter } from '../../../modules/academic-structure/index.js';
import { coursesRouter } from '../../../modules/courses/index.js';
import { knowledgeIngestionRouter } from '../../../modules/knowledge/index.js';
import { learnerDiagnosticRouter } from '../../../modules/learner/index.js';

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

// Feature module routers (diagnostics, tutor, ...) are mounted here
// by their module composition roots as each module is implemented.

export default router;