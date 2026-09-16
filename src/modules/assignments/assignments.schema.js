import { z } from 'zod';
import { ASSIGNMENT_STATUS, ASSIGNMENT_QUESTION_TYPES, OBJECTIVE_QUESTION_TYPES } from '../../config/constants.js';
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

const questionTypeField = z.enum(Object.values(ASSIGNMENT_QUESTION_TYPES));

const questionOptionInputSchema = z.object({
  text: z.string().trim().min(1, 'option text is required').max(500),
});

const correctOptionIndexesField = z
  .array(z.coerce.number().int().min(0).max(7))
  .min(1)
  .max(8)
  .optional();

const createQuestionSchema = z
  .object({
    questionText: questionTextField,
    topicId: topicIdField,
    maxScore: maxScoreField,
    orderIndex: orderIndexField.optional(),
    modelAnswer: privateTextField.optional(),
    rubricText: privateTextField.optional(),
    questionType: questionTypeField.default(ASSIGNMENT_QUESTION_TYPES.ESSAY),
    options: z.array(questionOptionInputSchema).min(2).max(8).optional(),
    correctOptionIndexes: correctOptionIndexesField,
    correctAnswer: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const issue = (message) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    const type = data.questionType;
    const isObjective = OBJECTIVE_QUESTION_TYPES.includes(type);
    if (type === ASSIGNMENT_QUESTION_TYPES.MULTIPLE_CHOICE || type === ASSIGNMENT_QUESTION_TYPES.MULTIPLE_SELECT) {
      if (!data.options) {
        issue('options are required for multiple_choice and multiple_select questions');
      }
      if (!data.correctOptionIndexes || data.correctOptionIndexes.length === 0) {
        issue('correctOptionIndexes is required for multiple_choice and multiple_select questions');
      }
      if (
        type === ASSIGNMENT_QUESTION_TYPES.MULTIPLE_CHOICE &&
        data.correctOptionIndexes &&
        data.correctOptionIndexes.length !== 1
      ) {
        issue('multiple_choice questions take exactly one correct option');
      }
    }
    if (type === ASSIGNMENT_QUESTION_TYPES.TRUE_FALSE) {
      if (data.correctAnswer === undefined) {
        issue('correctAnswer (true|false) is required for true_false questions');
      }
      if (data.correctOptionIndexes !== undefined) {
        issue('true_false questions use correctAnswer instead of correctOptionIndexes');
      }
    }
    if (!isObjective && (data.options !== undefined || data.correctOptionIndexes !== undefined || data.correctAnswer !== undefined)) {
      issue('options/correct answers are only accepted for objective questions (multiple_choice, multiple_select, true_false)');
    }
  });

const updateQuestionSchema = z
  .object({
    questionText: questionTextField.optional(),
    topicId: topicIdField,
    maxScore: maxScoreField.optional(),
    orderIndex: orderIndexField.optional(),
    modelAnswer: privateTextField.optional(),
    rubricText: privateTextField.optional(),
    correctOptionIndexes: correctOptionIndexesField,
    correctAnswer: z.boolean().optional(),
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
