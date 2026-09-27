import mongoose from 'mongoose';

/**
 * Embedding of a course topic (title + summary), used to map questions,
 * practice requests and assessment items to a topic without an LLM call.
 * Kept out of the course document so course reads stay small.
 */
const topicVectorSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    topicId: { type: mongoose.Schema.Types.ObjectId, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    embeddingModel: { type: String, required: true },
  },
  { timestamps: true },
);

topicVectorSchema.index({ courseId: 1, topicId: 1 }, { unique: true });

export default mongoose.models.TopicVector ?? mongoose.model('TopicVector', topicVectorSchema);
