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
};

export const DB_READY_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};
