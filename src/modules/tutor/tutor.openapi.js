/** OpenAPI documentation for tutor chat management (rename / delete). */
import { renameTutorSessionSchema } from './tutor.schema.js';
import { op, ok, errors, body, pathParams, objectId } from '../../api/v1/docs/openapi-helpers.js';

const TAG = 'AI Tutor';

export const paths = {
  '/courses/{courseId}/tutor/sessions/{tutorSessionId}': {
    patch: op({
      tag: TAG,
      summary: 'Rename one of my tutor chats',
      description: 'title null resets it to the automatic title.',
      parameters: pathParams('courseId', 'tutorSessionId'),
      requestBody: body(renameTutorSessionSchema),
      responses: { ...ok('Renamed chat', { data: { $ref: '#/components/schemas/TutorSession' } }), ...errors('vufn') },
    }),
    delete: op({
      tag: TAG,
      summary: 'Delete one of my tutor chats',
      parameters: pathParams('courseId', 'tutorSessionId'),
      responses: { ...ok('Deleted', { data: { type: 'object', properties: { id: objectId, deleted: { type: 'boolean' } } } }), ...errors('ufn') },
    }),
  },
};
