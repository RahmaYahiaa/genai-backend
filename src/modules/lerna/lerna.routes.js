import { buildLocalLearningState } from './local-learning.js';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../../config/index.js';
import { ValidationError } from '../../shared/errors/index.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';

/**
 * Student-facing LeRna (Academic OS) surface, mounted under /students/me/*.
 * All requests are authenticated our-side; the AI service sees only the
 * mapped `genai-{id}` student id. Contracts here are the honest passthrough
 * of LeRna's documented endpoints (learning aggregate, preferences, SM-2).
 */
const reviewSchema = z.object({
  concept: z.string().trim().min(1).max(300),
  remembered: z.boolean(),
});

const preferencesSchema = z
  .object({
    preferredLanguage: z
      .enum(['en', 'ar', 'fr', 'sw', 'ha', 'am', 'so', 'yo', 'ig', 'zu'])
      .optional(),
    learningPreference: z.string().trim().min(1).max(120).optional(),
    course: z.string().trim().min(1).max(300).optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: 'At least one preference field is required',
  });

export function createLernaController({ lernaService }) {
  function requireEnabled() {
    if (!config.lerna.enabled) {
      throw new ValidationError('The AI service integration is not enabled on this deployment.');
    }
  }

  async function getLearning(req, res) {
    // AI engine first; when it is unreachable or has no mastery yet, use the
    // platform's own evidence so "My Progress" reflects the student's answers.
    let learning = null;
    if (config.lerna.enabled) {
      learning = await lernaService.getLearningState(req.user).catch(() => null);
    }
    const engineHasMastery = Object.keys(learning?.profile?.concept_mastery ?? {}).length > 0;
    if (!engineHasMastery) {
      const local = await buildLocalLearningState(req.user);
      learning = { ...local, review_queue: learning?.review_queue ?? [] };
    }
    res.json({ success: true, data: learning });
  }

  async function recordReview(req, res) {
    requireEnabled();
    const result = await lernaService.recordConceptReview(req.user, req.body.concept, req.body.remembered);
    res.json({ success: true, data: result });
  }

  async function getPreferences(req, res) {
    requireEnabled();
    const preferences = await lernaService.getPreferences(req.user);
    res.json({ success: true, data: preferences });
  }

  async function updatePreferences(req, res) {
    requireEnabled();
    const preferences = await lernaService.updatePreferences(req.user, req.body);
    res.json({ success: true, data: preferences });
  }

  async function health(req, res) {
    requireEnabled();
    const status = await lernaService.health();
    const caps = await lernaService.capabilities().catch(() => null);
    res.json({ success: true, data: { ...status, capabilities: caps } });
  }

  return { getLearning, recordReview, getPreferences, updatePreferences, health };
}

export function createLernaRouter({ controller, middlewares }) {
  const { authenticate } = middlewares;
  const router = Router();

  router.get('/students/me/learning', authenticate, controller.getLearning);
  router.post(
    '/students/me/learning/review',
    authenticate,
    validateSchemas({ body: reviewSchema }),
    controller.recordReview,
  );
  router.get('/students/me/ai-preferences', authenticate, controller.getPreferences);
  router.patch(
    '/students/me/ai-preferences',
    authenticate,
    validateSchemas({ body: preferencesSchema }),
    controller.updatePreferences,
  );
  router.get('/students/me/ai-health', authenticate, controller.health);
  return router;
}
