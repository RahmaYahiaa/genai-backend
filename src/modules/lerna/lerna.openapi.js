/**
 * OpenAPI documentation for the signed-in student's AI learning data
 * (LeRna bridge). Every endpoint falls back to the platform's own evidence
 * when the AI service is unreachable, so it never fails just because LeRna is down.
 */
import { reviewSchema, preferencesSchema } from './lerna.routes.js';
import { op, ok, errors, body } from '../../api/v1/docs/openapi-helpers.js';

const TAG = 'AI Learning';
const source = {
  type: 'string',
  enum: ['lerna', 'platform_evidence', 'platform'],
  description: 'Where the data came from: the AI engine, or the platform fallback.',
};

export const paths = {
  '/students/me/learning': {
    get: op({
      tag: TAG,
      summary: 'My progress: mastery, weak points, next step, study plan and review queue',
      responses: {
        ...ok('Learning aggregate', {
          data: {
            type: 'object',
            properties: {
              profile: {
                type: 'object',
                properties: {
                  concept_mastery: { type: 'object', additionalProperties: { type: 'number' }, description: 'concept -> mastery 0..1' },
                  weak_concepts: { type: 'array', items: { type: 'string' } },
                  strengths: { type: 'array', items: { type: 'string' } },
                  misconceptions: { type: 'array', items: { type: 'string' } },
                },
              },
              next_action: { type: 'object', nullable: true, description: 'Recommended next step with reasons and priority.' },
              study_plan: { type: 'array', items: { type: 'object' } },
              review_queue: { type: 'array', items: { type: 'object' }, description: 'Concepts due for spaced review (SM-2).' },
              source,
            },
          },
          example: { profile: { concept_mastery: {}, weak_concepts: [], strengths: [], misconceptions: [] }, next_action: null, study_plan: [], review_queue: [], source: 'platform_evidence' },
        }),
        ...errors('u'),
      },
    }),
  },
  '/students/me/learning/review': {
    post: op({
      tag: TAG,
      summary: 'Record a spaced-review answer (remembered or not)',
      description: '`recorded: false` means the AI service was unreachable and nothing was stored.',
      requestBody: body(reviewSchema),
      responses: { ...ok('Result', { data: { type: 'object', properties: { recorded: { type: 'boolean' } }, additionalProperties: true } }), ...errors('vu') },
    }),
  },
  '/students/me/ai-preferences': {
    get: op({
      tag: TAG,
      summary: 'My AI preferences (answer language and learning style)',
      description: 'preferredLanguage is the language the tutor and study tools answer in.',
      responses: {
        ...ok('Preferences', {
          data: {
            type: 'object',
            properties: {
              studentId: { type: 'string' },
              name: { type: 'string' },
              course: { type: 'string', nullable: true },
              preferredLanguage: { type: 'string', enum: ['en', 'ar', 'fr', 'sw', 'ha', 'am', 'so', 'yo', 'ig', 'zu'] },
              learningPreference: { type: 'string', nullable: true },
              source,
            },
            additionalProperties: true,
          },
        }),
        ...errors('u'),
      },
    }),
    patch: op({
      tag: TAG,
      summary: 'Update my AI preferences',
      requestBody: body(preferencesSchema),
      responses: { ...ok('Updated preferences', { data: { type: 'object', additionalProperties: true } }), ...errors('vu') },
    }),
  },
  '/students/me/ai-health': {
    get: op({
      tag: TAG,
      summary: 'Is the AI service reachable?',
      description: 'When unreachable or disabled, every AI feature keeps working on the platform fallback.',
      responses: {
        ...ok('Status', {
          data: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'unreachable', description: 'ok / unreachable / disabled' },
              fallback: { type: 'string', example: 'platform' },
              capabilities: { type: 'object', description: 'Present when reachable.' },
            },
            additionalProperties: true,
          },
          example: { status: 'unreachable', fallback: 'platform' },
        }),
        ...errors('u'),
      },
    }),
  },
};
