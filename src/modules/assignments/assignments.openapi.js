/** OpenAPI documentation for assignment routes added after assignments.docs.js. */
import { feedbackVisibilitySchema } from './assignments.schema.js';
import { op, ok, errors, body, pathParams } from '../../api/v1/docs/openapi-helpers.js';


export const paths = {
  '/assignments/{assignmentId}/feedback-visibility': {
    patch: op({
      tag: 'Assignments & Grading',
      summary: 'Show or hide written feedback to students',
      description: 'Course staff. Separate from grade visibility: grades and feedback can be released independently.',
      parameters: pathParams('assignmentId'),
      requestBody: body(feedbackVisibilitySchema),
      responses: { ...ok('Updated assignment', { data: { $ref: '#/components/schemas/Assignment' } }), ...errors('vufn') },
    }),
  },
};
