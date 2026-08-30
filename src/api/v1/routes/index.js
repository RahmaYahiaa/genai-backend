import { Router } from 'express';
import healthRoutes from './health.routes.js';

const router = Router();

router.use(healthRoutes);

// Feature module routers (auth, academic-structure, courses, ...) are mounted
// here by their module composition roots as each module is implemented.

export default router;
