/** OpenAPI documentation for Study Tools (generated learning resources). */
import { generateResourcesSchema, listResourcesQuerySchema } from './learning-resources.schema.js';
import { op, ok, errors, body, pathParams, queryFromZod, objectId } from '../../api/v1/docs/openapi-helpers.js';

const TAG = 'Study Tools';

const resource = {
  type: 'object',
  properties: {
    id: objectId,
    courseId: objectId,
    userId: { ...objectId, nullable: true },
    topic: { type: 'string' },
    language: { type: 'string' },
    kind: { type: 'string', example: 'summary' },
    status: { type: 'string', enum: ['ready', 'unavailable'] },
    content: { nullable: true, description: 'Text kinds: the generated content (shape depends on kind). File kinds: null, download via /learning-resources/{id}/file.' },
    hasArtifact: { type: 'boolean', description: 'true for diagram (SVG) and presentation (PPTX).' },
    mime: { type: 'string', nullable: true },
    unavailableReason: { type: 'string', nullable: true, description: 'Why a kind could not be produced (e.g. image/audio/video are not supported).' },
    knowledgeSource: { type: 'string', enum: ['uploaded_material', 'trusted_external', 'none'] },
    model: { type: 'string', nullable: true },
    batchId: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

export const paths = {
  '/courses/{courseId}/learning-resources': {
    post: op({
      tag: TAG,
      summary: 'Generate study material (summary, flashcards, quiz, diagram, slides...)',
      description:
        'Any course member. Give a topic, a course file (materialId), or both, and up to 10 kinds. ' +
        'Answers are grounded in the course files. Each kind comes back ready or unavailable with a reason.',
      parameters: pathParams('courseId'),
      requestBody: body(generateResourcesSchema),
      responses: {
        ...ok('Generated batch', { status: 201, data: { type: 'object', properties: { batchId: { type: 'string' }, items: { type: 'array', items: resource } } } }),
        ...errors('vufnr'),
      },
    }),
    get: op({
      tag: TAG,
      summary: 'My generated material in this course',
      description: 'Only the caller\'s own items. Instructor and student items are never mixed.',
      parameters: [...pathParams('courseId'), ...queryFromZod(listResourcesQuerySchema)],
      responses: {
        ...ok('Page of resources', {
          data: { type: 'array', items: resource },
          meta: { type: 'object', properties: { total: { type: 'integer' }, page: { type: 'integer' }, limit: { type: 'integer' } } },
        }),
        ...errors('vufn'),
      },
    }),
  },
  '/learning-resources/{resourceId}/file': {
    get: op({
      tag: TAG,
      summary: 'Download a generated file (SVG diagram or PPTX slides)',
      description: 'Owner only.',
      parameters: pathParams('resourceId'),
      responses: {
        200: {
          description: 'The file',
          content: {
            'image/svg+xml': { schema: { type: 'string', format: 'binary' } },
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': { schema: { type: 'string', format: 'binary' } },
          },
        },
        ...errors('ufn'),
      },
    }),
  },
  '/learning-resources/{resourceId}': {
    delete: op({
      tag: TAG,
      summary: 'Delete one of my generated items',
      parameters: pathParams('resourceId'),
      responses: { ...ok('Deleted', { data: { type: 'object', properties: { id: objectId, deleted: { type: 'boolean' } } } }), ...errors('ufn') },
    }),
  },
};
