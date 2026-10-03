/** OpenAPI documentation for Plany, the study agent. */
import { createPlanSchema, listPlansQuerySchema, completeTaskSchema, replanSchema, chatSchema, reminderSettingsSchema, unsubscribeSchema } from './sanad.schema.js';
import { op, ok, errors, body, pathParams, queryFromZod, objectId } from '../../api/v1/docs/openapi-helpers.js';

const TAG = 'Plany';
const task = {
  type: 'object',
  properties: {
    id: objectId,
    type: { type: 'string', enum: ['check', 'learn', 'practice', 'quiz', 'review', 'reassess'] },
    topicId: objectId,
    topicTitle: { type: 'string' },
    minutes: { type: 'integer' },
    title: { type: 'string' },
    why: { type: 'string' },
    status: { type: 'string', enum: ['pending', 'in_progress', 'done', 'skipped'] },
    refKind: { type: 'string', nullable: true, enum: ['practice', 'reassessment', null], description: 'The practice or progress-check session that runs this task.' },
    refId: { ...objectId, nullable: true },
    lesson: { type: 'object', nullable: true, description: 'For learn tasks: explanation, example, keyPoints, flashcards, exercises.' },
    result: { type: 'object', nullable: true, properties: { score: { type: 'number', nullable: true }, answered: { type: 'integer' }, total: { type: 'integer' }, feeling: { type: 'string', nullable: true } } },
  },
};
const plan = {
  type: 'object',
  properties: {
    id: objectId,
    courseId: objectId,
    courseTitle: { type: 'string' },
    examDate: { type: 'string', example: '2026-10-20' },
    dailyMinutes: { type: 'integer' },
    status: { type: 'string', enum: ['active', 'completed', 'archived'] },
    source: { type: 'string', enum: ['lerna', 'ai', 'rules'], description: 'Who made the plan: LeRna, the backend AI, or the simple rules used only when no AI is reachable.' },
    summary: { type: 'string' },
    focusTopics: { type: 'array', items: { type: 'object', properties: { topicId: objectId, title: { type: 'string' }, reason: { type: 'string' }, levelAtStart: { type: 'string' }, scoreAtStart: { type: 'number' } } } },
    days: { type: 'array', items: { type: 'object', properties: { id: objectId, date: { type: 'string' }, title: { type: 'string' }, focus: { type: 'string' }, tasks: { type: 'array', items: task } } } },
    notes: { type: 'array', items: { type: 'object', properties: { at: { type: 'string', format: 'date-time' }, kind: { type: 'string' }, decision: { type: 'string' }, message: { type: 'string' } } } },
    progress: { type: 'array', items: { type: 'object', properties: { topicId: objectId, title: { type: 'string' }, level: { type: 'string' }, score: { type: 'number' }, levelAtStart: { type: 'string', nullable: true }, scoreAtStart: { type: 'number', nullable: true } } } },
    stats: { type: 'object', properties: { total: { type: 'integer' }, done: { type: 'integer' }, minutes: { type: 'integer' } } },
  },
};
const note = { type: 'object', nullable: true, properties: { decision: { type: 'string' }, message: { type: 'string' } } };
const reminders = { type: 'object', properties: { enabled: { type: 'boolean' }, time: { type: 'string', example: '21:30', description: '24-hour HH:MM in the student timezone (the app shows it as 12-hour with AM/PM).' }, timezone: { type: 'string', example: 'Africa/Cairo' } } };
const planAndNote = { type: 'object', properties: { plan, note } };

export const paths = {
  '/sanad/chat': {
    post: op({ tag: TAG, summary: 'Talk to Plany', description: 'Send a message.', requestBody: body(chatSchema), responses: { ...ok('Reply', { data: { type: 'object', properties: { reply: { type: 'string' }, intent: { type: 'string' }, action: { type: 'object', nullable: true } } } }), ...errors('vufr') } }),
  },
  '/sanad/overview': {
    get: op({ tag: TAG, summary: 'My courses and plans', description: 'For the Plany home.', responses: { ...ok('Courses and plans'), ...errors('uf') } }),
  },
  '/sanad/plans': {
    post: op({ tag: TAG, summary: 'Make a study plan', description: 'Builds the plan.', requestBody: body(createPlanSchema), responses: { ...ok('The plan', { status: 201, data: plan }), ...errors('vufnr') } }),
    get: op({ tag: TAG, summary: 'My plans', description: 'Newest first.', parameters: queryFromZod(listPlansQuerySchema), responses: { ...ok('Plans'), ...errors('vuf') } }),
  },
  '/sanad/plans/{planId}': {
    get: op({ tag: TAG, summary: 'Open a plan', description: 'With progress per topic.', parameters: pathParams('planId'), responses: { ...ok('The plan', { data: plan }), ...errors('ufn') } }),
    delete: op({ tag: TAG, summary: 'Stop a plan', description: 'Archives the plan.', parameters: pathParams('planId'), responses: { ...ok('Archived'), ...errors('ufn') } }),
  },
  '/sanad/plans/{planId}/replan': {
    post: op({ tag: TAG, summary: 'Rearrange after missed days', description: 'Moves unfinished work forward.', parameters: pathParams('planId'), requestBody: body(replanSchema), responses: { ...ok('Updated plan', { data: planAndNote }), ...errors('vufnr') } }),
  },
  '/sanad/plans/{planId}/tasks/{taskId}/start': {
    post: op({ tag: TAG, summary: 'Start a task', description: 'Prepares the lesson or the questions.', parameters: pathParams('planId', 'taskId'), responses: { ...ok('Plan and task', { data: { type: 'object', properties: { plan, task } } }), ...errors('vufnr') } }),
  },
  '/sanad/plans/{planId}/tasks/{taskId}/complete': {
    post: op({ tag: TAG, summary: 'Finish a task', description: 'Plany adapts the plan.', parameters: pathParams('planId', 'taskId'), requestBody: body(completeTaskSchema), responses: { ...ok('Updated plan', { data: planAndNote }), ...errors('vufnr') } }),
  },
  '/sanad/plans/{planId}/tasks/{taskId}/skip': {
    post: op({ tag: TAG, summary: 'Skip a task', description: 'Marks it skipped.', parameters: pathParams('planId', 'taskId'), responses: { ...ok('Updated plan', { data: plan }), ...errors('ufn') } }),
  },
  '/sanad/reminders': {
    get: op({ tag: TAG, summary: 'My study reminder settings', description: 'Daily reminder email.', responses: { ...ok('Settings', { data: reminders }), ...errors('uf') } }),
    patch: op({ tag: TAG, summary: 'Change study reminders', description: 'On/off and time.', requestBody: body(reminderSettingsSchema), responses: { ...ok('Settings', { data: reminders }), ...errors('vuf') } }),
  },
  '/sanad/reminders/test': {
    post: op({ tag: TAG, summary: 'Send me a reminder now', description: 'For trying it out.', responses: { ...ok('Result'), ...errors('ufr') } }),
  },
  '/sanad/reminders/unsubscribe': {
    post: op({ tag: TAG, auth: false, summary: 'Stop reminders from the email link', description: 'No login needed.', requestBody: body(unsubscribeSchema), responses: { ...ok('Reminders are off'), ...errors('vfr') } }),
  },
};
