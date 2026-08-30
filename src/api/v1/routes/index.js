import { Router } from 'express';
import healthRoutes from './health.routes.js';
import { authRouter } from '../../../modules/auth/index.js';

const router = Router();

router.use(healthRoutes);
router.use('/auth', authRouter);

// Feature module routers (academic-structure, courses, ...) are mounted here
// by their module composition roots as each module is implemented.

export default router;