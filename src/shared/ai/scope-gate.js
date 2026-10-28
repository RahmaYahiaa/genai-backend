import { z } from 'zod';
import { logger } from '../../config/logger.js';

/**
 * Educational scope gate shared by study assistants. Classifies a student
 * message before any answer is generated. Only academic or study questions
 * are allowed; everything else is refused. The caller decides what to do with
 * 'invalid' (classifier failed or returned an unusable result): treat it as
 * refused (fail closed).
 */
const scopeSchema = z.object({
  scope: z.enum(['educational', 'off_topic', 'inappropriate']),
});

const SCOPE_SYSTEM_PROMPT =
  'You classify a student message for an academic learning assistant. ' +
  'Return "educational" if the message asks to learn, understand, practise, plan or get help with an academic or study subject ' +
  '(any school, university or professional subject such as mathematics, sciences, computing, engineering, languages, history, ' +
  'economics or politics as subjects of study, or how to study and plan study time). ' +
  'Return "off_topic" for anything else: current news, a specific person or celebrity, entertainment, sports, gossip, ' +
  'shopping, personal or romantic advice, opinions on current politics, or chit-chat with no learning goal. ' +
  'Return "inappropriate" for sexual, violent, hateful or otherwise unacceptable content. ' +
  'Respond with JSON only, matching exactly: {"scope":"educational"|"off_topic"|"inappropriate"}';

const REFUSAL = {
  ar: 'أنا هنا للمساعدة في المذاكرة والخطط الدراسية فقط. قولي عايز تذاكر إيه أو امتحان إمتى، وأنا أساعدك.',
  en: 'I can only help with studying and study plans. Tell me what you want to study or when your exam is, and I will help.',
};

const UNAVAILABLE = {
  ar: 'مقدرتش أتأكد من الرسالة دي دلوقتي. جرّب تاني بعد شوية.',
  en: 'I could not check this message right now. Please try again in a moment.',
};

export function scopeReplyFor(message, kind = 'refused') {
  const ar = /[\u0600-\u06FF]/.test(message ?? '');
  const table = kind === 'unavailable' ? UNAVAILABLE : REFUSAL;
  return ar ? table.ar : table.en;
}

export async function classifyEducationalScope({ llmProvider, message, task = 'classify_message_scope' }) {
  try {
    const raw = await llmProvider.completeJson({
      task,
      system: SCOPE_SYSTEM_PROMPT,
      user: JSON.stringify({ message }),
    });
    const parsed = scopeSchema.safeParse(raw);
    return parsed.success ? parsed.data.scope : 'invalid';
  } catch (error) {
    logger.warn({ err: String(error?.message).slice(0, 300) }, 'Scope check failed (fail closed)');
    return 'invalid';
  }
}
