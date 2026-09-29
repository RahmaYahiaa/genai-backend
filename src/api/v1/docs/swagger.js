import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readdirSync } from 'node:fs';
import swaggerJsdoc from 'swagger-jsdoc';
import { config } from '../../../config/index.js';
import { securitySchemes } from './components/security-schemes.js';
import { schemas } from './components/schemas.js';
import { commonResponses } from './components/responses.js';
import { applyRouteTexts } from './descriptions.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(currentDir, '../../..');

// Every tag here is used by at least one documented route (checked by
// `npm run docs:check`). Order = order in the Swagger UI.
const API_TAGS = [
  { name: 'Health', description: 'Is the server running?' },
  { name: 'Auth', description: 'Sign up, sign in, email verification, password reset and my profile.' },
  { name: 'Invitations', description: 'Joining through an emailed invitation link, and linking a personal account to a university.' },
  { name: 'Academic Structure', description: 'The institution and its faculties, departments, programs and semesters.' },
  { name: 'Courses', description: 'Courses, finding and joining them, join requests, teaching staff and topics.' },
  { name: 'Knowledge Ingestion', description: 'Course files that the AI learns the course from.' },
  { name: 'Learner Flow', description: '"Check my level": a short test at the start that shows what the student already knows.' },
  { name: 'Learner Model', description: 'How well the student knows each topic and what to study next.' },
  { name: 'AI Tutor', description: 'Chat with a tutor that answers from the course files and shows where each answer came from.' },
  { name: 'Practice Loop', description: 'Short practice questions on one topic, marked instantly.' },
  { name: 'Reassessment & Gain', description: '"Measure progress": test a topic again later and see how much the student improved.' },
  { name: 'Study Tools', description: 'Summaries, notes, flashcards, quizzes, diagrams, slides and more, made from the course files.' },
  { name: 'AI Learning', description: 'The student\'s overall progress, study plan, topics due for review, and AI language preferences.' },
  { name: 'Assignments & Grading', description: 'Instructors create assignments, students answer them, the AI suggests a grade and the instructor decides. University courses only.' },
  { name: 'Remedial', description: 'Extra explanations or practice the instructor sends to students.' },
  { name: 'Instructor Analytics', description: 'How the course is going: results per topic, topics without questions, and the instructor overview.' },
  { name: 'Audit', description: 'History of every grading decision in a course.' },
  { name: 'Institution Admin', description: 'The admin area: people, admin team, invitations, join requests, institution profile, settings and reports.' },
];

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'Lerna API',
    version: '0.1.0',
    description:
      'Lerna is an AI learning platform for universities and personal learners. ',
    license: { name: 'UNLICENSED' },
  },
  servers: [
    {
      url: '/api/v1',
      description: config.isProduction ? 'Production' : 'Local development',
    },
  ],
  tags: API_TAGS,
  components: {
    securitySchemes,
    schemas,
    responses: commonResponses,
  },
  paths: {},
};

/**
 * Collects annotation source files by walking directories explicitly instead
 * of using glob patterns: glob libraries disagree on path separators between
 * Windows and Linux, while explicit file paths work identically everywhere.
 *
 * Sources:
 * - every `.js` file under `src/api/v1/routes/` (shared/health annotations)
 * - every `<module>.docs.js` file under `src/modules/` (per-module API docs, YAML)
 * - every `<module>.openapi.js` file under `src/modules/` (JS objects, merged below)
 */
function collectAnnotationFiles(dir, suffix) {
  const collected = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectAnnotationFiles(entryPath, suffix));
    } else if (entry.name.endsWith(suffix)) {
      collected.push(entryPath);
    }
  }
  return collected;
}

const jsdocSpec = swaggerJsdoc({
  definition,
  apis: [
    ...collectAnnotationFiles(path.resolve(srcDir, 'api', 'v1', 'routes'), '.js'),
    ...collectAnnotationFiles(path.resolve(srcDir, 'modules'), '.docs.js'),
  ],
});

/**
 * `<module>.openapi.js` files export `paths` as plain objects whose request
 * schemas are generated from the routes' zod validators. They are merged
 * per method; documenting the same operation twice is a startup error.
 */
async function mergeOpenApiModules(spec) {
  const files = collectAnnotationFiles(path.resolve(srcDir, 'modules'), '.openapi.js').sort();
  for (const file of files) {
    const { paths = {} } = await import(pathToFileURL(file).href);
    for (const [route, operations] of Object.entries(paths)) {
      spec.paths[route] ??= {};
      for (const [method, operation] of Object.entries(operations)) {
        if (spec.paths[route][method]) {
          throw new Error(`OpenAPI: ${method.toUpperCase()} ${route} is documented twice (${path.basename(file)})`);
        }
        spec.paths[route][method] = operation;
      }
    }
  }
  return spec;
}

export const swaggerSpec = applyRouteTexts(await mergeOpenApiModules(jsdocSpec));