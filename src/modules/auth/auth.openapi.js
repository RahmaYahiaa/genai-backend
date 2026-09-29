/** OpenAPI documentation for email verification and password reset (6-digit codes). */
import { verifyEmailSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schema.js';
import { op, ok, errors, body } from '../../api/v1/docs/openapi-helpers.js';

const TAG = 'Auth';
const CODE_NOTE = 'Codes are 6 digits, valid for 15 minutes, 5 attempts.';

export const paths = {
  '/auth/verify-email': {
    post: op({
      tag: TAG,
      summary: 'Verify my email with the 6-digit code',
      description: `Works for a signed-in but unverified account. New self-registered accounts cannot use anything else until verified. ${CODE_NOTE}`,
      requestBody: body(verifyEmailSchema),
      responses: { ...ok('Verified account', { data: { $ref: '#/components/schemas/AuthUser' } }), ...errors('vur') },
    }),
  },
  '/auth/verify-email/resend': {
    post: op({
      tag: TAG,
      summary: 'Send a new verification code',
      description: 'Limited to 3 per 15 minutes and 10 per day, with a 60-second wait between sends. Returns `{ emailVerified: true }` when already verified.',
      responses: {
        ...ok('Sent', {
          data: { type: 'object', properties: { sent: { type: 'boolean' }, expiresInMinutes: { type: 'integer', nullable: true }, emailVerified: { type: 'boolean' } } },
        }),
        ...errors('ur'),
      },
    }),
  },
  '/auth/forgot-password': {
    post: op({
      tag: TAG,
      auth: false,
      summary: 'Email a password reset code',
      description: 'Public. Always answers `{ sent: true }`, even for unknown emails, so accounts cannot be discovered.',
      requestBody: body(forgotPasswordSchema),
      responses: { ...ok('Accepted', { data: { type: 'object', properties: { sent: { type: 'boolean' } } } }), ...errors('vr') },
    }),
  },
  '/auth/reset-password': {
    post: op({
      tag: TAG,
      auth: false,
      summary: 'Set a new password with the reset code',
      description: `Public. Signs out every existing session and emails a "password changed" notice. ${CODE_NOTE}`,
      requestBody: body(resetPasswordSchema),
      responses: { ...ok('Password changed', { data: { type: 'object', properties: { reset: { type: 'boolean' } } } }), ...errors('vr') },
    }),
  },
};
