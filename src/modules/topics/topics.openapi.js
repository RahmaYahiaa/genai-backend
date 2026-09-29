/** OpenAPI documentation for AI topic detection maintenance (course staff). */
import { z } from 'zod';
import { op, ok, errors, body, pathParams, objectId } from '../../api/v1/docs/openapi-helpers.js';

const TAG = 'Courses';
const mergeBody = z.object({ fromTopicId: z.string().describe('Topic to remove (24-character id)'), intoTopicId: z.string().describe('Topic that keeps everything (24-character id)') });

export const paths = {
  '/courses/{courseId}/topics/detect': {
    post: op({
      tag: TAG,
      summary: 'Run AI topic detection on course files that are not processed yet',
      description: 'Course staff (or admin). Normally runs by itself after every upload; this re-runs it for files still pending.',
      parameters: pathParams('courseId'),
      responses: {
        ...ok('Detected topics per file', {
          data: { type: 'object', properties: { results: { type: 'array', items: { type: 'object', properties: { materialId: objectId, topics: { type: 'array', items: { type: 'object' } } } } } } },
        }),
        ...errors('ufnr'),
      },
    }),
  },
  '/courses/{courseId}/topics/merge': {
    post: op({
      tag: TAG,
      summary: 'Merge two detected topics into one',
      description: 'Course staff (or admin). Everything linked to fromTopicId moves to intoTopicId.',
      parameters: pathParams('courseId'),
      requestBody: body(mergeBody),
      responses: { ...ok('Merged', { data: { type: 'object', properties: { mergedInto: objectId } } }), ...errors('vufn') },
    }),
  },
};
