/** OpenAPI documentation for course routes added after courses.docs.js. */
import { op, ok, errors, pathParams, objectId } from '../../api/v1/docs/openapi-helpers.js';

const TAG = 'Courses';

export const paths = {
  '/courses/creation-policy': {
    get: op({
      tag: TAG,
      summary: 'Can I create courses?',
      description: 'allowDoctorCourseCreation = the institution lets instructors create courses; canCreatePersonal = the caller can create personal courses (individual learners).',
      responses: {
        ...ok('Policy', {
          data: { type: 'object', properties: { allowDoctorCourseCreation: { type: 'boolean' }, canCreatePersonal: { type: 'boolean' } } },
          example: { allowDoctorCourseCreation: true, canCreatePersonal: false },
        }),
        ...errors('uf'),
      },
    }),
  },
  '/courses/{courseId}/catalog-enroll': {
    post: op({
      tag: TAG,
      summary: 'Join a catalog course of my study year',
      description:
        'Institutional students with a verified email. Courses outside the student\'s year need a join request instead (403). ' +
        '409 when already enrolled or a request is pending.',
      parameters: pathParams('courseId'),
      responses: {
        ...ok('Enrolled', { status: 201, data: { type: 'object', properties: { courseId: objectId, studentId: objectId, enrolled: { type: 'boolean' } } } }),
        ...errors('ufncr'),
      },
    }),
  },
};
