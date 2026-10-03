import { Router } from 'express';
import { authenticate } from '../auth/index.js';
import { coursesService } from '../courses/index.js';
import { learnerModelService } from '../learner/index.js';
import { topicDetectionService } from '../topics/index.js';
import { practiceService, practiceSessionModel } from '../practice/index.js';
import { reassessmentService, reassessmentSessionModel } from '../reassessment/index.js';
import { llmProvider } from '../../ai/llm/index.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess, sendCreated } from '../../shared/http/api-response.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import { ForbiddenError } from '../../shared/errors/index.js';
import { createSanadService } from './sanad.service.js';
import { createReminderService } from './sanad.reminders.js';
import { planIdParamSchema, taskParamSchema, createPlanSchema, listPlansQuerySchema, completeTaskSchema, replanSchema, chatSchema, reminderSettingsSchema, unsubscribeSchema } from './sanad.schema.js';

// Plany: the study agent. Understands the goal, reads the student's level,
// builds a day-by-day plan with AI, teaches, tests, adapts and re-checks.
export const sanadService = createSanadService({
  coursesService,
  learnerModelService,
  topicDetectionService,
  practiceService,
  reassessmentService,
  practiceSessionModel,
  reassessmentSessionModel,
  llmProvider,
});

// Daily study reminder emails (turned on/off from Profile > Preferences).
export const sanadReminders = createReminderService({ llmProvider });

const studentsOnly = (req, _res, next) => (req.user?.role === 'student' ? next() : next(new ForbiddenError('Plany is available to students')));
const v = validateSchemas;
const s = sanadService;

// Public: the "Stop reminders" link in the email (signed, no login needed).
// Mounted before the routers that require login.
export const sanadPublicRouter = Router();
sanadPublicRouter.post('/reminders/unsubscribe', v({ body: unsubscribeSchema }), asyncHandler(async (req, res) => {
  const [userId, token] = req.validated.body.token.split('.');
  const ok = await sanadReminders.unsubscribe(userId, token);
  if (!ok) throw new ForbiddenError('This link is not valid');
  sendSuccess(res, { data: { enabled: false } });
}));

export const sanadRouter = Router();
sanadRouter.use(authenticate, studentsOnly);

sanadRouter.get('/reminders', asyncHandler(async (req, res) => sendSuccess(res, { data: await sanadReminders.getSettings(req.user) })));
sanadRouter.patch('/reminders', v({ body: reminderSettingsSchema }), asyncHandler(async (req, res) => sendSuccess(res, { data: await sanadReminders.updateSettings(req.user, req.validated.body) })));
sanadRouter.post('/reminders/test', asyncHandler(async (req, res) => sendSuccess(res, { data: await sanadReminders.sendTest(req.user) })));

sanadRouter.post('/chat', v({ body: chatSchema }), asyncHandler(async (req, res) => sendSuccess(res, { data: await s.chat(req.user, req.validated.body) })));
sanadRouter.get('/overview', asyncHandler(async (req, res) => sendSuccess(res, { data: await s.overview(req.user) })));
sanadRouter.post('/plans', v({ body: createPlanSchema }), asyncHandler(async (req, res) => {
  void sanadReminders.rememberTimezone(req.user.id, req.validated.body.timezone).catch(() => {});
  sendCreated(res, await s.createPlan(req.user, req.validated.body));
}));
sanadRouter.get('/plans', v({ query: listPlansQuerySchema }), asyncHandler(async (req, res) => sendSuccess(res, { data: await s.listPlans(req.user, req.validated.query) })));
sanadRouter.get('/plans/:planId', v({ params: planIdParamSchema }), asyncHandler(async (req, res) => sendSuccess(res, { data: await s.getPlan(req.user, req.validated.params.planId) })));
sanadRouter.delete('/plans/:planId', v({ params: planIdParamSchema }), asyncHandler(async (req, res) => sendSuccess(res, { data: await s.archivePlan(req.user, req.validated.params.planId) })));
sanadRouter.post('/plans/:planId/replan', v({ params: planIdParamSchema, body: replanSchema }), asyncHandler(async (req, res) => sendSuccess(res, { data: await s.replan(req.user, req.validated.params.planId, req.validated.body) })));
sanadRouter.post('/plans/:planId/tasks/:taskId/start', v({ params: taskParamSchema }), asyncHandler(async (req, res) => sendSuccess(res, { data: await s.startTask(req.user, req.validated.params.planId, req.validated.params.taskId) })));
sanadRouter.post('/plans/:planId/tasks/:taskId/complete', v({ params: taskParamSchema, body: completeTaskSchema }), asyncHandler(async (req, res) => sendSuccess(res, { data: await s.completeTask(req.user, req.validated.params.planId, req.validated.params.taskId, req.validated.body) })));
sanadRouter.post('/plans/:planId/tasks/:taskId/skip', v({ params: taskParamSchema }), asyncHandler(async (req, res) => sendSuccess(res, { data: await s.skipTask(req.user, req.validated.params.planId, req.validated.params.taskId) })));
