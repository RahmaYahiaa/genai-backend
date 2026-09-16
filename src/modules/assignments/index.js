import Assignment from './assignment.model.js';
import AssignmentQuestion from './assignment-question.model.js';
import * as assignmentRepository from './assignment.repository.js';
import * as assignmentQuestionRepository from './assignment-question.repository.js';
import { authenticate } from '../auth/index.js';
import { coursesService } from '../courses/index.js';
import { auditService } from '../audit/index.js';
import { domainEvents } from '../analytics/index.js';
import { submissionsService } from '../submissions/index.js';
import { createAssignmentsService } from './assignments.service.js';
import { createAssignmentsController } from './assignments.controller.js';
import { createAssignmentsRouter } from './assignments.routes.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import {
  courseIdParamSchema,
  assignmentIdParamSchema,
  questionIdParamSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
  createQuestionSchema,
  updateQuestionSchema,
  gradeVisibilitySchema,
  listAssignmentsQuerySchema,
} from './assignments.schema.js';

export { Assignment as assignmentModel, AssignmentQuestion as assignmentQuestionModel };
export { assignmentRepository, assignmentQuestionRepository };

export const assignmentsService = createAssignmentsService({
  assignmentRepository,
  assignmentQuestionRepository,
  coursesService,
  auditService,
  domainEvents,
});

const controller = createAssignmentsController({ assignmentsService, submissionsService });

export const assignmentsRouter = createAssignmentsRouter({
  controller,
  middlewares: { authenticate },
  validators: {
    courseIdParam: validateSchemas({ params: courseIdParamSchema }),
    assignmentIdParam: validateSchemas({ params: assignmentIdParamSchema }),
    questionIdParam: validateSchemas({ params: questionIdParamSchema }),
    createAssignment: validateSchemas({ body: createAssignmentSchema }),
    updateAssignment: validateSchemas({ body: updateAssignmentSchema }),
    createQuestion: validateSchemas({ body: createQuestionSchema }),
    updateQuestion: validateSchemas({ body: updateQuestionSchema }),
    gradeVisibility: validateSchemas({ body: gradeVisibilitySchema }),
    listAssignmentsQuery: validateSchemas({ query: listAssignmentsQuerySchema }),
  },
});