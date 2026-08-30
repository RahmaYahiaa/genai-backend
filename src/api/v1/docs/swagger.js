import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import swaggerJsdoc from 'swagger-jsdoc';
import { config } from '../../../config/index.js';
import { securitySchemes } from './components/security-schemes.js';
import { schemas } from './components/schemas.js';
import { commonResponses } from './components/responses.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(currentDir, '../../..');

const API_TAGS = [
  { name: 'Health', description: 'Service liveness and readiness' },
  { name: 'Auth', description: 'Registration, login, tokens, profile' },
  {
    name: 'Academic Structure',
    description: 'Institutions and the faculty/department/program/semester hierarchy',
  },
  { name: 'Courses', description: 'Courses, topics, learning objectives, staff, enrollments' },
  { name: 'Knowledge Base', description: 'Approved course material upload and processing' },
  { name: 'Diagnostics', description: 'AI-driven diagnostic sessions and evidence' },
  { name: 'Learner Model', description: 'Per-student mastery profile and learning gaps' },
  { name: 'Tutor', description: 'Course-aware, learner-aware AI tutoring sessions' },
  {
    name: 'Personalization',
    description: 'Next-best-action decisions and personalized activities',
  },
  {
    name: 'Content Generation',
    description: 'Grounded explanations, examples, quizzes, flashcards, lessons',
  },
  { name: 'Assessments', description: 'Assessment, practice, and reassessment flows' },
  { name: 'Instructor Analytics', description: 'Aggregated course/topic mastery and gap insights' },
  { name: 'Interventions', description: 'Targeted instructor interventions' },
  {
    name: 'Teaching Assistant',
    description: 'Assignment submissions, AI-suggested grading, instructor approval',
  },
  { name: 'Audit', description: 'Governance and audit trail' },
];

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'GenAI Backend API',
    version: '0.1.0',
    description:
      'AI Academic Learning Platform. Course-aware, learner-aware, evidence-grounded learning APIs. ' +
      'All AI answers are grounded in approved course material; mastery is computed deterministically from structured evidence.',
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
 * - every `<module>.docs.js` file under `src/modules/` (per-module API docs)
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

export const swaggerSpec = swaggerJsdoc({
  definition,
  apis: [
    ...collectAnnotationFiles(path.resolve(srcDir, 'api', 'v1', 'routes'), '.js'),
    ...collectAnnotationFiles(path.resolve(srcDir, 'modules'), '.docs.js'),
  ],
});