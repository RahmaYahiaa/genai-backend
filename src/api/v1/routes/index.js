import { Router } from 'express';
import healthRoutes from './health.routes.js';
import { authRouter } from '../../../modules/auth/index.js';
import { academicStructureRouter } from '../../../modules/academic-structure/index.js';
import { coursesRouter } from '../../../modules/courses/index.js';

const router = Router();

router.use(healthRoutes);
router.use('/auth', authRouter);
// Handles /institutions/* and /units/* routes internally.
router.use(academicStructureRouter);
router.use('/courses', coursesRouter);

// Feature module routers (knowledge-base, diagnostics, ...) are mounted here
// by their module composition roots as each module is implemented.

export default router;