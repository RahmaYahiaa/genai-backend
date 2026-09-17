/**
 * Shared vocabulary for the whole platform. Keeping enums in one place lets
 * Mongoose schemas, Zod validators, and Swagger annotations stay in sync.
 */

// --- Identity & access ---
export const ROLES = {
  STUDENT: 'student',
  INSTRUCTOR: 'instructor',
  INSTITUTION_ADMIN: 'institution_admin',
};

export const ROLE_VALUES = Object.values(ROLES);

export const TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh',
};

// How a user is attached to the platform: inside an institution tenant, or as
// an independent learner with a personal learning space.
export const ACCOUNT_TYPES = {
  INSTITUTIONAL: 'institutional',
  INDIVIDUAL: 'individual',
};

export const LANGUAGES = {
  ENGLISH: 'en',
  ARABIC: 'ar',
};

// --- Academic structure ---
export const ACADEMIC_UNIT_TYPES = {
  FACULTY: 'faculty',
  DEPARTMENT: 'department',
  PROGRAM: 'program',
  SEMESTER: 'semester',
};

export const COURSE_STAFF_ROLES = {
  INSTRUCTOR: 'instructor',
  TEACHING_ASSISTANT: 'teaching_assistant',
};

// --- Knowledge base / RAG ---
export const MATERIAL_SOURCE_TYPES = {
  OFFICIAL_SLIDES: 'official_slides',
  LECTURE_NOTES: 'lecture_notes',
  TEXTBOOK: 'textbook',
  INSTRUCTOR_NOTES: 'instructor_notes',
  EXTERNAL_REFERENCE: 'external_reference',
};

export const MATERIAL_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
  STORED_ONLY: 'stored_only',
};

export const ENROLLMENT_REQUEST_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

// --- Learning loop ---
export const ASSESSMENT_TYPES = {
  DIAGNOSTIC: 'diagnostic',
  PRACTICE: 'practice',
  ASSESSMENT: 'assessment',
  REASSESSMENT: 'reassessment',
};

export const EVIDENCE_SOURCE_TYPES = {
  DIAGNOSTIC: 'diagnostic',
  PRACTICE: 'practice',
  ASSESSMENT: 'assessment',
  REASSESSMENT: 'reassessment',
  ASSIGNMENT: 'assignment',
};

export const CORRECTNESS_LEVELS = {
  INCORRECT: 'incorrect',
  PARTIAL: 'partial',
  CORRECT: 'correct',
};

export const QUESTION_DIFFICULTIES = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

// --- RAG retrieval over material_chunks (trusted sources only) ---
export const RETRIEVAL_SETTINGS = {
  TOP_K: 5, // max material chunks fetched per query
  MIN_SCORE: 0.05, // below this a chunk is noise, not evidence
  SNIPPET_LENGTH: 200, // citation snippet length stored in tutor messages
};

export const MASTERY_LEVELS = {
  NO_EVIDENCE: 'no_evidence',
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  MASTERED: 'mastered',
};

export const GAP_SEVERITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

export const GAP_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
};

export const MISCONCEPTION_STATUSES = {
  SUSPECTED: 'suspected',
  CONFIRMED: 'confirmed',
  RESOLVED: 'resolved',
};

// --- AI surfaces ---
export const TUTOR_MODES = {
  EXPLANATION: 'explanation',
  WORKED_EXAMPLE: 'worked_example',
  SUMMARY: 'summary',
  REVISION: 'revision',
  CODING_HELP: 'coding_help',
  GUIDED_QUESTIONING: 'guided_questioning',
  PRACTICE: 'practice',
};

export const CONTENT_TYPES = {
  EXPLANATION: 'explanation',
  EXAMPLE: 'example',
  SUMMARY: 'summary',
  FLASHCARDS: 'flashcards',
  QUIZ: 'quiz',
  PRACTICE_ITEM: 'practice_item',
  REVISION: 'revision',
  LESSON: 'lesson',
  SPEAKER_NOTES: 'speaker_notes',
};

export const CONTENT_AUDIENCES = {
  STUDENT: 'student',
  INSTRUCTOR: 'instructor',
};

export const CONTENT_STATUSES = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
};

export const GROUNDING_STATUSES = {
  GROUNDED: 'grounded',
  PARTIALLY_GROUNDED: 'partially_grounded',
  INSUFFICIENT_EVIDENCE: 'insufficient_evidence',
  UNVERIFIED: 'unverified',
};

// --- AI Teaching Assistant ---
export const SUBMISSION_REVIEW_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  EDITED: 'edited',
  REJECTED: 'rejected',
};

// --- Error codes (stable strings exposed to API consumers) ---
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_IDENTIFIER: 'INVALID_IDENTIFIER',
  RATE_LIMITED: 'RATE_LIMITED',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  FEATURE_NOT_AVAILABLE_FOR_PERSONAL_COURSE: 'FEATURE_NOT_AVAILABLE_FOR_PERSONAL_COURSE',
  ASSIGNMENT_CLOSED: 'ASSIGNMENT_CLOSED',
  NOT_FAST_TRACK_ELIGIBLE: 'NOT_FAST_TRACK_ELIGIBLE',
  REASON_REQUIRED: 'REASON_REQUIRED',
};

export const DB_READY_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export const ASSIGNMENT_STATUS = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
};

export const SUBMISSION_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  GRADING: 'GRADING',
  GRADED: 'GRADED',
  RESUBMISSION_REQUESTED: 'RESUBMISSION_REQUESTED',
  FINALIZED: 'FINALIZED',
};

export const ASSIGNMENT_QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'multiple_choice',
  MULTIPLE_SELECT: 'multiple_select',
  TRUE_FALSE: 'true_false',
  SHORT_ANSWER: 'short_answer',
  LONG_ANSWER: 'long_answer',
  ESSAY: 'essay',
  PROBLEM_SOLVING: 'problem_solving',
};

export const OBJECTIVE_QUESTION_TYPES = [
  ASSIGNMENT_QUESTION_TYPES.MULTIPLE_CHOICE,
  ASSIGNMENT_QUESTION_TYPES.MULTIPLE_SELECT,
  ASSIGNMENT_QUESTION_TYPES.TRUE_FALSE,
];

export const DETERMINISTIC_GRADER_VERSION = 'deterministic-v1';

export const AI_CONFIDENCE = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
};

export const AI_CORRECTNESS = {
  CORRECT: 'CORRECT',
  PARTIAL: 'PARTIAL',
  INCORRECT: 'INCORRECT',
};

export const GRADING_PROMPT_VERSION = 'grading-v1';

export const FINAL_GRADE_DECISIONS = {
  APPROVED: 'APPROVED',
  EDITED: 'EDITED',
  REJECTED_MANUAL: 'REJECTED_MANUAL',
};

export const AUDIT_ACTIONS = {
  APPROVE: 'APPROVE',
  EDIT: 'EDIT',
  REJECT: 'REJECT',
  REQUEST_RESUBMISSION: 'REQUEST_RESUBMISSION',
  TOGGLE_GRADE_VISIBILITY: 'TOGGLE_GRADE_VISIBILITY',
  TOGGLE_FEEDBACK_VISIBILITY: 'TOGGLE_FEEDBACK_VISIBILITY',
};

export const REMEDIAL_ORIGINS = {
  FROM_MISCONCEPTION: 'FROM_MISCONCEPTION',
  STANDALONE: 'STANDALONE',
};

export const REMEDIAL_CONTENT_TYPES = {
  FOCUSED_EXPLANATION_WITH_EXAMPLE: 'FOCUSED_EXPLANATION_WITH_EXAMPLE',
  EXTRA_PRACTICE_QUESTIONS: 'EXTRA_PRACTICE_QUESTIONS',
};

export const REMEDIAL_STATUSES = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
};

export const REMEDIAL_AUDIENCE_TYPES = {
  ALL_STUDENTS: 'ALL_STUDENTS',
  AFFECTED_STUDENTS: 'AFFECTED_STUDENTS',
  SELECTED_STUDENTS: 'SELECTED_STUDENTS',
};

export const REMEDIAL_PROMPT_VERSION = 'remedial-v1';
