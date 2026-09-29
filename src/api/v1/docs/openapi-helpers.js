import { z } from 'zod';

/**
 * Small builders for `<module>.openapi.js` documentation files.
 *
 * Request bodies and query strings are generated from the SAME zod schemas
 * the routes validate with, so the docs cannot drift from the real contract.
 */

/** zod schema -> OpenAPI 3.0 schema (input side: defaults are optional). */
export function fromZod(schema) {
  const json = z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input', unrepresentable: 'any' });
  delete json.$schema;
  return json;
}

/** Path parameters: pathParams('courseId', 'userId'). All ids are 24-char ObjectIds unless described otherwise. */
export function pathParams(...names) {
  return names.map((entry) => {
    const [name, description] = Array.isArray(entry) ? entry : [entry, `${entry} (24-character id)`];
    return { in: 'path', name, required: true, description, schema: { type: 'string' } };
  });
}

/** Query parameters generated from a zod object schema. */
export function queryFromZod(schema) {
  const json = fromZod(schema);
  const required = new Set(json.required ?? []);
  return Object.entries(json.properties ?? {}).map(([name, prop]) => ({
    in: 'query',
    name,
    required: required.has(name),
    schema: prop,
  }));
}

/** JSON request body from a zod schema. */
export function body(schema, description) {
  return {
    required: true,
    ...(description ? { description } : {}),
    content: { 'application/json': { schema: fromZod(schema) } },
  };
}

/** Success envelope `{ success: true, data }` with an optional data schema and a real example. */
export function ok(description, { data, example, status = 200, meta } = {}) {
  const dataSchema = data ?? {};
  const envelope = {
    allOf: [
      { $ref: '#/components/schemas/SuccessEnvelope' },
      { type: 'object', properties: { data: dataSchema, ...(meta ? { meta } : {}) } },
    ],
  };
  return {
    [status]: {
      description,
      content: {
        'application/json': {
          schema: envelope,
          ...(example !== undefined ? { example: { success: true, data: example } } : {}),
        },
      },
    },
  };
}

const ref = (name) => ({ $ref: `#/components/responses/${name}` });

/** Standard error responses. Pick with letters: v=400 u=401 f=403 n=404 c=409 r=429. */
export function errors(codes = 'uf') {
  const map = { v: ['400', 'ValidationError'], u: ['401', 'Unauthorized'], f: ['403', 'Forbidden'], n: ['404', 'NotFound'], c: ['409', 'Conflict'], r: ['429', 'RateLimited'] };
  const out = {};
  for (const letter of codes) if (map[letter]) out[map[letter][0]] = ref(map[letter][1]);
  out['500'] = ref('InternalError');
  return out;
}

/** One operation. `auth: false` marks a public endpoint. */
export function op({ tag, summary, description, auth = true, parameters, requestBody, responses }) {
  return {
    tags: [tag],
    summary,
    ...(description ? { description } : {}),
    ...(auth ? { security: [{ bearerAuth: [] }] } : { security: [] }),
    ...(parameters?.length ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses,
  };
}

// Reusable shapes -------------------------------------------------------------

export const bilingual = {
  type: 'object',
  properties: { en: { type: 'string' }, ar: { type: 'string' } },
};

export const objectId = { type: 'string', example: '665f1c9e2a4b3c6d7e8f9a0b' };
