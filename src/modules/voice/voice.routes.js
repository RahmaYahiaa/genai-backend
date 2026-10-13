import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess, sendCreated } from '../../shared/http/api-response.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import { ServiceUnavailableError, UnauthorizedError } from '../../shared/errors/index.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const createVoiceSessionSchema = z.object({
  courseId: objectId,
  topicId: z.string().min(1).max(120).optional(),
  lessonId: z.string().min(1).max(120).optional(),
  resume: z.boolean().optional(),
});

const sessionParamSchema = z.object({ sessionId: z.string().regex(/^vs_[A-Za-z0-9]+$/, 'Invalid session id') });
const latestQuerySchema = z.object({ courseId: objectId });

const saveTranscriptSchema = z.object({
  turns: z
    .array(
      z.object({
        role: z.enum(['student', 'tutor']),
        text: z.string().max(8000),
      }),
    )
    .max(500),
});

const facadeChatSchema = z.object({
  student_id: objectId,
  message: z.string().min(1).max(2000),
  course: objectId,
  document_ids: z.array(objectId).max(50).nullish(),
});

function bearerMatches(header, expectedKey) {
  const expected = Buffer.from(`Bearer ${expectedKey}`);
  const received = Buffer.from(String(header ?? ''));
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

/**
 * Browser-facing voice routes (authenticated student) plus the server-to-server
 * facade the LernaVoice service calls for course grounding. The facade is
 * mounted separately so it can use its own key instead of a student token.
 */
export function createVoiceRouter({ voiceService, authenticate }) {
  const router = Router();

  router.get(
    '/voice/status',
    authenticate,
    asyncHandler(async (req, res) => {
      sendSuccess(res, { data: await voiceService.status() });
    }),
  );

  router.get(
    '/voice/sessions/latest',
    authenticate,
    validateSchemas({ query: latestQuerySchema }),
    asyncHandler(async (req, res) => {
      const latest = await voiceService.latestFor(req.user, req.validated.query.courseId);
      sendSuccess(res, { data: latest });
    }),
  );

  router.post(
    '/voice/sessions',
    authenticate,
    validateSchemas({ body: createVoiceSessionSchema }),
    asyncHandler(async (req, res) => {
      const session = await voiceService.startSession(req.user, req.validated.body);
      sendCreated(res, session);
    }),
  );

  router.post(
    '/voice/sessions/:sessionId/token',
    authenticate,
    validateSchemas({ params: sessionParamSchema }),
    asyncHandler(async (req, res) => {
      const minted = await voiceService.mintTokenFor(req.user, req.validated.params.sessionId);
      sendSuccess(res, { data: minted });
    }),
  );

  router.post(
    '/voice/sessions/:sessionId/transcript',
    authenticate,
    validateSchemas({ params: sessionParamSchema, body: saveTranscriptSchema }),
    asyncHandler(async (req, res) => {
      const saved = await voiceService.saveTranscript(req.user, req.validated.params.sessionId, req.validated.body.turns);
      sendSuccess(res, { data: saved });
    }),
  );

  return router;
}

export function createVoiceFacadeRouter({ voiceService, facadeApiKey }) {
  const router = Router();

  router.post(
    '/lerna-facade/tutor/chat',
    asyncHandler(async (req, res, next) => {
      if (!facadeApiKey) throw new ServiceUnavailableError('Voice grounding is not configured');
      if (!bearerMatches(req.headers.authorization, facadeApiKey)) throw new UnauthorizedError('Invalid facade key');
      next();
    }),
    validateSchemas({ body: facadeChatSchema }),
    asyncHandler(async (req, res) => {
      const body = req.validated.body;
      const result = await voiceService.retrieveEvidence({
        studentId: body.student_id,
        courseId: body.course,
        message: body.message,
        documentIds: body.document_ids ?? null,
      });
      res.json(result);
    }),
  );

  return router;
}
