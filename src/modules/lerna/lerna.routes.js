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
export const reviewSchema = z.object({
  concept: z.string().trim().min(1).max(300),
  remembered: z.boolean(),
});

export const preferencesSchema = z
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

  // Spaced-repetition reviews live only in the AI engine. The queue is empty
  // when the engine is down, so a failure here is reported, not faked.
  async function recordReview(req, res) {
    requireEnabled();
    try {
      const result = await lernaService.recordConceptReview(req.user, req.body.concept, req.body.remembered);
      res.json({ success: true, data: { recorded: true, ...result } });
    } catch {
      res.json({ success: true, data: { recorded: false } });
    }
  }

  // Preferences: engine profile first; otherwise the platform's own account
  // language plus locally computed mastery, marked with source.
  async function localPreferences(user) {
    const local = await buildLocalLearningState(user).catch(() => null);
    return {
      studentId: user.id,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      course: null,
      preferredLanguage: user.aiLanguage ?? user.languagePreference ?? 'en',
      learningPreference: null,
      conceptMastery: local?.profile?.concept_mastery ?? {},
      weakConcepts: local?.profile?.weak_concepts ?? [],
      unknownConcepts: [],
      strengths: [],
      source: 'platform_evidence',
    };
  }

  async function getPreferences(req, res) {
    let preferences = null;
    if (config.lerna.enabled) {
      preferences = await lernaService.getPreferences(req.user).catch(() => null);
    }
    res.json({ success: true, data: preferences ?? (await localPreferences(req.user)) });
  }

  async function updatePreferences(req, res) {
    // The AI answer language is always saved on the account too, so the tutor
    // and study tools follow it even when the AI engine is unreachable.
    if (req.body.preferredLanguage) {
      const { default: User } = await import('../auth/user.model.js');
      await User.updateOne({ _id: req.user.id }, { $set: { aiLanguage: req.body.preferredLanguage } });
      req.user.aiLanguage = req.body.preferredLanguage;
    }
    if (config.lerna.enabled) {
      const updated = await lernaService.updatePreferences(req.user, req.body).catch(() => null);
      if (updated) return res.json({ success: true, data: updated });
    }
    return res.json({ success: true, data: await localPreferences(req.user) });
  }

  async function health(req, res) {
    if (!config.lerna.enabled) {
      return res.json({ success: true, data: { status: 'disabled', fallback: 'platform' } });
    }
    const status = await lernaService.health().catch(() => null);
    const caps = status ? await lernaService.capabilities().catch(() => null) : null;
    return res.json({
      success: true,
      data: status ? { ...status, capabilities: caps } : { status: 'unreachable', fallback: 'platform' },
    });
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
