/** OpenAPI documentation for listing practice sessions. */
import { op, ok, errors, pathParams } from '../../api/v1/docs/openapi-helpers.js';

export const paths = {
  '/courses/{courseId}/practice/sessions': {
    get: op({
      tag: 'Practice Loop',
      summary: 'My practice sessions in this course',
      parameters: pathParams('courseId'),
      responses: { ...ok('Sessions, newest first', { data: { type: 'array', items: { $ref: '#/components/schemas/PracticeSession' } } }), ...errors('ufn') },
    }),
  },
};
