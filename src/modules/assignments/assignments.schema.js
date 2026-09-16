import { z } from 'zod';
import { ASSIGNMENT_STATUS } from '../../config/constants.js';
import { objectIdField } from '../academic-structure/academic-structure.schema.js';

const courseIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
});

const assignmentIdParamSchema = z.object({
  assignmentId: objectIdField('assignmentId'),
});

const questionIdParamSchema = z.object({
  assignmentId: objectIdField('assignmentId'),
  questionId: objectIdField('questionId'),
});

const titleField = z.string().trim().min(2, 'title is required').max(200);

const createAssignmentSchema = z.object({
  title: titleField,
});

const updateAssignmentSchema = z.object({
  title: titleField,
});

const topicIdField = z.string().trim().min(1).max(64).optional();

const questionTextField = z.string().trim().min(1, 'questionText is required').max(10000);

const maxScoreField = z.coerce.number().positive('maxScore must be greater than 0').max(1000);

const orderIndexField = z.coerce.number().int().min(1).max(1000);

const privateTextField = z.string().trim().min(1).max(20000).nullable();

const createQuestionSchema = z.object({
  questionText: questionTextField,
  topicId: topicIdField,
  maxScore: maxScoreField,
  orderIndex: orderIndexField.optional(),
  modelAnswer: privateTextField.optional(),
  rubricText: privateTextField.optional(),
});

const updateQuestionSchema = z
  .object({
    questionText: questionTextField.optional(),
    topicId: topicIdField,
    maxScore: maxScoreField.optional(),
    orderIndex: orderIndexField.optional(),
    modelAnswer: privateTextField.optional(),
    rubricText: privateTextField.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: 'Provide at least one field to update',
  });

const gradeVisibilitySchema = z.object({
  showGradeToStudent: z.boolean(),
});

const listAssignmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(Object.values(ASSIGNMENT_STATUS)).optional(),
});

export {
  courseIdParamSchema,
  assignmentIdParamSchema,
  questionIdParamSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
  createQuestionSchema,
  updateQuestionSchema,
  gradeVisibilitySchema,
  listAssignmentsQuerySchema,
};