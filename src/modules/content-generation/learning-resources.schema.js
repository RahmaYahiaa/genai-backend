import { z } from 'zod';
import { objectIdField } from '../academic-structure/academic-structure.schema.js';

export const courseIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
});

export const resourceIdParamSchema = z.object({
  resourceId: objectIdField('resourceId'),
});

export const generateResourcesSchema = z.object({
  // Free-text subject and/or one course file to build from (either is enough).
  topic: z.string().trim().min(3).max(200).optional(),
  materialId: objectIdField('materialId').optional(),
  kinds: z
    .array(
      z.enum([
        'summary',
        'notes',
        'flashcards',
        'quiz',
        'code',
        'diagram',
        'presentation',
        'explanation',
        'study_guide',
        'coding_exercise',
        'analogy',
        'comparison',
        'exam',
        'practice',
        'question_bank',
        'image',
        'audio',
        'video',
      ]),
    )
    .min(1)
    .max(10),
  language: z.enum(['en', 'ar', 'fr', 'sw', 'ha', 'am', 'so', 'yo', 'ig', 'zu']).default('en'),
}).refine((value) => Boolean(value.topic || value.materialId), {
  message: 'Type a topic or choose a course file',
  path: ['topic'],
});

export const listResourcesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// --- Mandatory Zod contracts for LLM outputs (never trust the model) ---

const markdownResource = z.object({ text: z.string().trim().min(40).max(20000) });

export const llmTextResourceSchemas = {
  explanation: markdownResource,
  study_guide: markdownResource,
  coding_exercise: markdownResource,
  analogy: markdownResource,
  comparison: markdownResource,
  exam: markdownResource,
  practice: markdownResource,
  question_bank: markdownResource,
  summary: z.object({
    title: z.string().min(3).max(200),
    points: z.array(z.string().min(3).max(400)).min(3).max(8),
    takeaway: z.string().min(3).max(400).optional(),
  }),
  notes: z.object({
    title: z.string().min(3).max(200),
    sections: z
      .array(
        z.object({
          heading: z.string().min(1).max(120),
          bullets: z.array(z.string().min(2).max(300)).min(1).max(8),
        }),
      )
      .min(2)
      .max(8),
  }),
  flashcards: z.object({
    cards: z
      .array(
        z.object({
          front: z.string().min(3).max(300),
          back: z.string().min(3).max(600),
        }),
      )
      .min(4)
      .max(12),
  }),
  // Tolerant of harmless model variance (longer rationale, numeric strings,
  // a few extra questions) while still enforcing a usable quiz structure.
  quiz: z.object({
    questions: z
      .array(
        z.object({
          question: z.string().min(5).max(1000),
          options: z.array(z.string().min(1).max(400)).length(4),
          answerIndex: z.coerce.number().int().min(0).max(3),
          why: z.string().max(1500).optional().nullable(),
        }),
      )
      .min(3)
      .max(15)
      .transform((questions) => questions.slice(0, 10)),
  }),
  code: z.object({
    language: z.string().min(1).max(30),
    code: z.string().min(10).max(6000),
    explanation: z.string().min(10).max(1500),
  }),
};

// Tolerant of long labels / extra steps: trimmed to what the SVG can show.
const clip = (max) => (value) => (value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value);
export const llmDiagramSpecSchema = z.object({
  title: z.string().min(3).max(300).transform(clip(120)),
  steps: z
    .array(
      z.object({
        label: z.string().min(1).max(300).transform(clip(60)),
        detail: z.string().max(600).optional().nullable().transform((v) => (v ? clip(120)(v) : undefined)),
      }),
    )
    .min(2)
    .max(12)
    .transform((steps) => steps.slice(0, 6)),
});

export const llmDeckOutlineSchema = z.object({
  title: z.string().min(3).max(120),
  subtitle: z.string().max(160).optional(),
  slides: z
    .array(
      z.object({
        title: z.string().min(2).max(80),
        bullets: z.array(z.string().min(2).max(200)).min(1).max(6),
      }),
    )
    .min(3)
    .max(10),
});
