/** OpenAPI documentation for listing past diagnostics ("Check my level"). */
import { op, ok, errors, pathParams } from '../../api/v1/docs/openapi-helpers.js';

export const paths = {
  '/courses/{courseId}/diagnostics': {
    get: op({
      tag: 'Learner Flow',
      summary: 'My diagnostic attempts in this course',
      parameters: pathParams('courseId'),
      responses: { ...ok('Attempts, newest first', { data: { type: 'array', items: { $ref: '#/components/schemas/DiagnosticAssessment' } } }), ...errors('ufn') },
    }),
  },
};
