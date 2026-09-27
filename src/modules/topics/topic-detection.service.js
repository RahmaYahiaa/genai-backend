import mongoose from 'mongoose';
import { z } from 'zod';
import { logger } from '../../config/logger.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import TopicVector from './topic-vector.model.js';

/**
 * AI topic detection. Staff and students never have to type topics:
 *  - when a file is uploaded, the AI reads it and adds the topics it teaches
 *    to the course (reusing existing topics instead of duplicating them) and
 *    tags every chunk with its topic;
 *  - any learning activity (tutor question, "practise this", assessment item)
 *    is mapped to a topic: embedding similarity first (no LLM cost), a short
 *    AI classification only for borderline cases, and "no topic" when nothing
 *    fits, so evidence is never recorded against a wrong topic.
 * The topics themselves stay the backbone of the learner model (mastery,
 * weak/strong areas, learning gain, analytics).
 *
 * All AI calls go through llmProvider.completeJson, which runs on LeRna first
 * and on the local provider when LeRna is down.
 */

export const EXTRACT_TOPICS_PROMPT =
  'You organise university course material into study topics. You receive the ' +
  'course title, the topics the course already has, and numbered sections of ONE ' +
  'uploaded file. Identify the distinct teachable topics the file covers (usually ' +
  '1-8; a short file may have one). A topic is a unit a student can be strong or ' +
  "weak in (e.g. 'Deadlocks', 'CPU Scheduling', 'Binary Search Trees') - never a " +
  'whole course name, a chapter number, or a single fact.\n' +
  'Rules:\n' +
  '- If a topic is the same subject as an existing course topic, reuse it by ' +
  "returning its existingTopicId (do not create a near-duplicate such as 'Deadlock' vs 'Deadlocks').\n" +
  '- New topic titles: 2-6 words, Title Case, in English (standard academic naming), ' +
  'even if the file is in another language.\n' +
  '- summary: one sentence (max 30 words) describing what the topic covers in this course.\n' +
  '- sectionIds: the section numbers that belong to the topic; every section should ' +
  'belong to at least one topic when it has academic content.\n' +
  '- Ignore administrative text (grading policy, office hours, dates).\n' +
  'Return JSON only: {"topics":[{"title":string,"existingTopicId":string|null,' +
  '"summary":string,"sectionIds":[number]}]}';

export const CLASSIFY_TOPIC_PROMPT =
  "You map a student's learning activity (a question, a requested practice subject, " +
  'or an assessment question) to ONE topic of a course. You receive the text and the ' +
  'course topics (id, title, summary). Choose the topic the text is mainly about. ' +
  'If the text is not about any listed topic (off-course, greeting, too vague), ' +
  'return null. Do not guess: confidence below 0.5 means null.\n' +
  'Return JSON only: {"topicId":string|null,"confidence":number}';

const extractionSchema = z.object({
  topics: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(120),
        existingTopicId: z.string().trim().nullable().optional(),
        summary: z.string().trim().max(600).nullable().optional(),
        sectionIds: z.array(z.coerce.number().int()).default([]),
      }),
    )
    .max(15),
});

const classifySchema = z.object({
  topicId: z.string().trim().nullable(),
  confidence: z.coerce.number().min(0).max(1).default(0),
});

// Similarity thresholds (cosine) for embedding-based mapping.
const SIM_SURE = 0.8;
const SIM_MAYBE = 0.55;
const SIM_SAME_TOPIC = 0.9;
const MAX_SECTIONS = 40;
const SECTION_CHARS = 700;

function normTitle(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/s\b/g, '');
}

function cosine(a, b) {
  if (!a?.length || a.length !== b?.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function topicText(topic) {
  return [topic.title, topic.description].filter(Boolean).join(': ');
}

export function createTopicDetectionService({
  Course,
  Material,
  MaterialChunk,
  llmProvider,
  embeddingProvider,
  LearningEvidence = null,
}) {
  async function embedSafe(texts) {
    if (!embeddingProvider || texts.length === 0) return null;
    try {
      return await embeddingProvider.embed(texts);
    } catch (error) {
      logger.warn({ err: error.message }, 'Topic detection: embedding failed, using AI only');
      return null;
    }
  }

  /** Makes sure every topic of the course has an up-to-date vector. */
  async function ensureVectors(courseId) {
    const course = await Course.findById(courseId).select('topics').lean();
    if (!course) return [];
    const topics = course.topics ?? [];
    const existing = await TopicVector.find({ courseId }).lean();
    const byTopic = new Map(existing.map((v) => [String(v.topicId), v]));
    const stale = topics.filter((t) => byTopic.get(String(t._id))?.text !== topicText(t));
    if (stale.length && embeddingProvider) {
      const vectors = await embedSafe(stale.map(topicText));
      if (vectors) {
        await Promise.all(
          stale.map((topic, index) =>
            TopicVector.updateOne(
              { courseId, topicId: topic._id },
              {
                $set: {
                  text: topicText(topic),
                  embedding: vectors[index],
                  embeddingModel: embeddingProvider.model ?? 'unknown',
                },
              },
              { upsert: true },
            ),
          ),
        );
        stale.forEach((topic, index) =>
          byTopic.set(String(topic._id), { topicId: topic._id, text: topicText(topic), embedding: vectors[index] }),
        );
      }
    }
    // Vectors of deleted topics are dropped.
    const live = new Set(topics.map((t) => String(t._id)));
    const dead = existing.filter((v) => !live.has(String(v.topicId))).map((v) => v._id);
    if (dead.length) await TopicVector.deleteMany({ _id: { $in: dead } });
    return topics.map((topic) => ({ topic, vector: byTopic.get(String(topic._id))?.embedding ?? null }));
  }

  /**
   * Maps free text to a course topic.
   * @returns {Promise<{topicId:string,title:string,confidence:number,method:string}|null>}
   */
  async function classify(courseId, text, { allowAi = true } = {}) {
    const clean = String(text ?? '').trim();
    if (clean.length < 2) return null;
    const entries = await ensureVectors(courseId);
    if (entries.length === 0) return null;

    // Exact / near-exact title match costs nothing.
    const wanted = normTitle(clean);
    const direct = entries.find(({ topic }) => normTitle(topic.title) === wanted);
    if (direct) {
      return { topicId: String(direct.topic._id), title: direct.topic.title, confidence: 1, method: 'title' };
    }

    let ranked = entries.map((entry) => ({ ...entry, score: 0 }));
    const [queryVector] = (await embedSafe([clean])) ?? [];
    if (queryVector) {
      ranked = entries
        .map((entry) => ({ ...entry, score: entry.vector ? cosine(queryVector, entry.vector) : 0 }))
        .sort((a, b) => b.score - a.score);
      const best = ranked[0];
      if (best.score >= SIM_SURE && best.score - (ranked[1]?.score ?? 0) > 0.03) {
        return { topicId: String(best.topic._id), title: best.topic.title, confidence: best.score, method: 'similarity' };
      }
      if (best.score < SIM_MAYBE && entries.every((e) => e.vector)) return null;
    }
    if (!allowAi) return null;

    const candidates = ranked.slice(0, 8).map(({ topic }) => ({
      id: String(topic._id),
      title: topic.title,
      summary: topic.description ?? null,
    }));
    try {
      const raw = await llmProvider.completeJson({
        task: 'classify_topic',
        system: CLASSIFY_TOPIC_PROMPT,
        user: JSON.stringify({ text: clean.slice(0, 2000), topics: candidates }),
      });
      const parsed = classifySchema.safeParse(raw);
      if (!parsed.success || !parsed.data.topicId || parsed.data.confidence < 0.5) return null;
      const hit = candidates.find((c) => c.id === parsed.data.topicId);
      return hit ? { topicId: hit.id, title: hit.title, confidence: parsed.data.confidence, method: 'ai' } : null;
    } catch (error) {
      logger.warn({ err: error.message }, 'Topic classification failed');
      return null;
    }
  }

  /**
   * Reads one uploaded file and adds/links the topics it teaches.
   * `sectionTexts` is used when the file has no local chunks (LeRna-only indexing).
   */
  // One detection per file at a time (upload event + seed/manual re-run).
  const inflight = new Map();
  function detectForMaterial(materialId, options = {}) {
    const key = String(materialId);
    if (!inflight.has(key)) {
      inflight.set(key, runDetection(materialId, options).finally(() => inflight.delete(key)));
    }
    return inflight.get(key);
  }

  async function runDetection(materialId, { sectionTexts = null } = {}) {
    const material = await Material.findById(materialId).lean();
    if (!material) return null;
    const course = await Course.findById(material.courseId).lean();
    if (!course) return null;

    const chunks = await MaterialChunk.find({ materialId }).select('_id order text').sort({ order: 1 }).lean();
    const texts = chunks.length ? chunks.map((c) => c.text) : sectionTexts ?? [];
    if (texts.length === 0) {
      await Material.updateOne({ _id: materialId }, { $set: { topicDetection: 'skipped' } });
      return null;
    }

    // Long files: sample evenly so the whole file is represented.
    const step = Math.max(1, Math.ceil(texts.length / MAX_SECTIONS));
    const sections = [];
    for (let i = 0; i < texts.length; i += step) {
      sections.push({ id: sections.length + 1, from: i, to: Math.min(texts.length, i + step) - 1, text: texts[i].slice(0, SECTION_CHARS) });
    }
    const existing = (course.topics ?? []).map((t) => ({ id: String(t._id), title: t.title, summary: t.description ?? null }));

    let extracted;
    try {
      const raw = await llmProvider.completeJson({
        task: 'extract_topics',
        system: EXTRACT_TOPICS_PROMPT,
        user: JSON.stringify({
          course: course.title,
          fileTitle: material.title,
          existingTopics: existing,
          sections: sections.map(({ id, text }) => ({ id, text })),
        }),
      });
      const parsed = extractionSchema.safeParse(raw);
      if (!parsed.success) throw new Error('topic extraction output did not match the schema');
      extracted = parsed.data.topics;
    } catch (error) {
      logger.warn({ err: error.message, materialId: String(materialId) }, 'Topic detection failed');
      await Material.updateOne({ _id: materialId }, { $set: { topicDetection: 'failed' } });
      return null;
    }

    // Resolve every extracted topic to an existing or new course topic.
    const entries = await ensureVectors(course._id);
    const newTopics = extracted.filter((t) => !existing.some((e) => e.id === t.existingTopicId));
    const newVectors = (await embedSafe(newTopics.map((t) => [t.title, t.summary].filter(Boolean).join(': ')))) ?? [];
    const resolved = [];
    let order = (course.topics ?? []).reduce((max, t) => Math.max(max, t.order ?? 0), 0);
    for (const item of extracted) {
      let topicId = existing.find((e) => e.id === item.existingTopicId)?.id ?? null;
      if (!topicId) {
        const sameTitle = (course.topics ?? []).find((t) => normTitle(t.title) === normTitle(item.title));
        if (sameTitle) topicId = String(sameTitle._id);
      }
      if (!topicId) {
        const vector = newVectors[newTopics.indexOf(item)];
        if (vector) {
          const close = entries
            .map((e) => ({ id: String(e.topic._id), score: e.vector ? cosine(vector, e.vector) : 0 }))
            .sort((a, b) => b.score - a.score)[0];
          if (close && close.score >= SIM_SAME_TOPIC) topicId = close.id;
        }
      }
      if (!topicId) {
        const already = resolved.find((r) => r.isNew && normTitle(r.title) === normTitle(item.title));
        if (already) topicId = already.topicId;
      }
      if (!topicId) {
        order += 1;
        const _id = new mongoose.Types.ObjectId();
        await Course.updateOne(
          { _id: course._id },
          {
            $push: {
              topics: {
                _id,
                title: item.title,
                description: item.summary ?? null,
                order,
                source: 'ai',
                materialIds: [material._id],
              },
            },
          },
        );
        resolved.push({ topicId: String(_id), title: item.title, sectionIds: item.sectionIds, isNew: true });
      } else {
        await Course.updateOne(
          { _id: course._id, 'topics._id': topicId },
          { $addToSet: { 'topics.$.materialIds': material._id } },
        );
        resolved.push({ topicId, title: item.title, sectionIds: item.sectionIds, isNew: false });
      }
    }

    // Tag chunks with their topic (first topic claiming the section wins).
    if (chunks.length) {
      const chunkTopic = new Array(chunks.length).fill(null);
      for (const r of resolved) {
        for (const sid of r.sectionIds) {
          const section = sections[sid - 1];
          if (!section) continue;
          for (let i = section.from; i <= section.to; i += 1) chunkTopic[i] ??= r.topicId;
        }
      }
      // Unclaimed chunks inherit the nearest claimed neighbour.
      for (let i = 0; i < chunkTopic.length; i += 1) {
        if (!chunkTopic[i]) chunkTopic[i] = chunkTopic[i - 1] ?? chunkTopic.slice(i).find(Boolean) ?? null;
      }
      await MaterialChunk.bulkWrite(
        chunks.map((chunk, index) => ({
          updateOne: { filter: { _id: chunk._id }, update: { $set: { topicId: chunkTopic[index] } } },
        })),
      );
    }

    const counts = new Map();
    for (const r of resolved) counts.set(r.topicId, (counts.get(r.topicId) ?? 0) + Math.max(1, r.sectionIds.length));
    const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    await Material.updateOne(
      { _id: materialId },
      { $set: { topicDetection: 'done', topicIds: [...counts.keys()], topicId: material.topicId ?? main } },
    );
    await ensureVectors(course._id);
    return resolved.map(({ topicId, title, isNew }) => ({ topicId, title, isNew }));
  }

  /** Re-runs detection for files of a course that are pending or failed. */
  async function detectPending(courseId) {
    const pending = await Material.find({ courseId, topicDetection: { $in: ['pending', 'failed'] } })
      .select('_id')
      .lean();
    const results = [];
    for (const m of pending) results.push({ materialId: String(m._id), topics: await detectForMaterial(m._id) });
    return results;
  }

  /**
   * Merges topic `fromId` into `intoId`: every record pointing at the old
   * topic (evidence, sessions, files, chunks, questions) is moved, then the
   * old topic is removed.
   */
  async function mergeTopics(courseId, fromId, intoId) {
    if (String(fromId) === String(intoId)) throw new ValidationError('Choose two different topics');
    const course = await Course.findById(courseId).lean();
    if (!course) throw new NotFoundError('Course not found');
    const from = course.topics.find((t) => String(t._id) === String(fromId));
    const into = course.topics.find((t) => String(t._id) === String(intoId));
    if (!from || !into) throw new NotFoundError('Topic not found');
    const fromOid = new mongoose.Types.ObjectId(String(fromId));
    const intoOid = new mongoose.Types.ObjectId(String(intoId));
    const db = mongoose.connection.db;
    const collections = (await db.listCollections().toArray()).map((c) => c.name);
    for (const name of collections) {
      if (name === 'courses' || name === 'topicvectors') continue;
      await db.collection(name).updateMany({ courseId: course._id, topicId: fromOid }, { $set: { topicId: intoOid } });
      await db.collection(name).updateMany({ courseId: course._id, topicIds: fromOid }, { $addToSet: { topicIds: intoOid } });
      await db.collection(name).updateMany({ courseId: course._id, topicIds: fromOid }, { $pull: { topicIds: fromOid } });
    }
    await Course.updateOne(
      { _id: course._id, 'topics._id': intoOid },
      { $addToSet: { 'topics.$.materialIds': { $each: from.materialIds ?? [] } } },
    );
    await Course.updateOne({ _id: course._id }, { $pull: { topics: { _id: fromOid } } });
    await Course.updateOne(
      { _id: course._id },
      { $pull: { 'topics.$[].prerequisiteTopicIds': fromOid } },
    );
    await TopicVector.deleteOne({ courseId: course._id, topicId: fromOid });
    return { mergedInto: String(intoId) };
  }

  /** Topic of the chunks a file teaches (used by "practise from this file"). */
  async function topicsOfMaterial(materialId) {
    const material = await Material.findById(materialId).select('topicId topicIds').lean();
    return material ? { main: material.topicId ? String(material.topicId) : null, all: (material.topicIds ?? []).map(String) } : null;
  }

  /** Course-file excerpts that teach a topic (or one file), for grounding. */
  async function contextFor(courseId, { topicId = null, materialId = null, maxChars = 3500 } = {}) {
    const filter = { courseId };
    if (materialId) filter.materialId = materialId;
    else if (topicId) filter.topicId = topicId;
    else return [];
    const chunks = await MaterialChunk.find(filter).select('text order').sort({ order: 1 }).limit(12).lean();
    const out = [];
    let used = 0;
    for (const chunk of chunks) {
      if (used >= maxChars) break;
      const piece = chunk.text.slice(0, Math.min(900, maxChars - used));
      out.push(piece);
      used += piece.length;
    }
    return out;
  }

  /**
   * The topic a student should work on next: first a topic that has course
   * files but no evidence yet, otherwise the one with the lowest average score.
   */
  async function weakestTopic(courseId, userId) {
    const course = await Course.findById(courseId).select('topics').lean();
    const topics = course?.topics ?? [];
    if (topics.length === 0) return null;
    const stats = LearningEvidence
      ? await LearningEvidence.aggregate([
          { $match: { courseId: new mongoose.Types.ObjectId(String(courseId)), studentId: new mongoose.Types.ObjectId(String(userId)) } },
          { $group: { _id: '$topicId', avg: { $avg: '$score' }, n: { $sum: 1 } } },
        ])
      : [];
    const byTopic = new Map(stats.map((row) => [String(row._id), row]));
    const withFiles = topics.filter((t) => (t.materialIds ?? []).length > 0);
    const pool = withFiles.length ? withFiles : topics;
    const untouched = pool.find((t) => !byTopic.has(String(t._id)));
    if (untouched) return untouched;
    return [...pool].sort((a, b) => (byTopic.get(String(a._id))?.avg ?? 0) - (byTopic.get(String(b._id))?.avg ?? 0))[0];
  }

  /**
   * Resolves what a practice/assessment request is about.
   * Input: any of { topicId, focus (free text), materialId }; none = "suggest".
   * Output: { topicId|null, title, focus|null, materialId|null, context[] }.
   * topicId is null only when free text matches no course topic; the activity
   * still works but is not counted toward a topic.
   */
  async function resolveFocus(courseId, userId, { topicId = null, focus = null, materialId = null } = {}) {
    const course = await Course.findById(courseId).select('topics').lean();
    const topics = course?.topics ?? [];
    const byId = (id) => topics.find((t) => String(t._id) === String(id));
    if (topicId) {
      const topic = byId(topicId);
      if (!topic) throw new ValidationError('topicId must reference a topic of this course');
      return { topicId: String(topic._id), title: topic.title, focus: null, materialId: null, context: await contextFor(courseId, { topicId: topic._id }) };
    }
    if (materialId) {
      const material = await Material.findById(materialId).select('courseId title topicId topicIds').lean();
      if (!material || String(material.courseId) !== String(courseId)) throw new NotFoundError('Material not found');
      let topic = byId(material.topicId);
      if (!topic) {
        const hit = await classify(courseId, material.title);
        topic = hit ? byId(hit.topicId) : null;
      }
      return {
        topicId: topic ? String(topic._id) : null,
        title: topic?.title ?? material.title,
        focus: material.title,
        materialId: String(material._id),
        context: await contextFor(courseId, { materialId: material._id }),
      };
    }
    if (focus && focus.trim()) {
      const hit = await classify(courseId, focus);
      const topic = hit ? byId(hit.topicId) : null;
      return {
        topicId: topic ? String(topic._id) : null,
        title: focus.trim(),
        focus: focus.trim(),
        materialId: null,
        context: topic ? await contextFor(courseId, { topicId: topic._id }) : [],
      };
    }
    const weakest = await weakestTopic(courseId, userId);
    if (!weakest) throw new ValidationError('This course has no topics yet. Add course files first, or type what you want to practise.');
    return { topicId: String(weakest._id), title: weakest.title, focus: null, materialId: null, context: await contextFor(courseId, { topicId: weakest._id }) };
  }

  /**
   * Always returns a topic id for an item that must belong to one (assessment
   * questions): AI/similarity match, else the nearest topic, else a 'General'
   * topic for courses that have no files yet.
   */
  async function topicForItem(courseId, text) {
    const hit = await classify(courseId, text);
    if (hit) return hit.topicId;
    const entries = await ensureVectors(courseId);
    if (entries.length) {
      const [vector] = (await embedSafe([String(text ?? '').slice(0, 2000)])) ?? [];
      if (vector) {
        const best = entries
          .map((e) => ({ id: String(e.topic._id), score: e.vector ? cosine(vector, e.vector) : 0 }))
          .sort((a, b) => b.score - a.score)[0];
        if (best) return best.id;
      }
      const general = entries.find((e) => normTitle(e.topic.title) === 'general');
      if (general) return String(general.topic._id);
    }
    const _id = new mongoose.Types.ObjectId();
    await Course.updateOne(
      { _id: courseId },
      { $push: { topics: { _id, title: 'General', description: 'Items not tied to a specific course topic.', order: 999, source: 'ai' } } },
    );
    return String(_id);
  }

  return {
    topicForItem,
    classify,
    detectForMaterial,
    detectPending,
    ensureVectors,
    mergeTopics,
    topicsOfMaterial,
    contextFor,
    weakestTopic,
    resolveFocus,
  };
}
