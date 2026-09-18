import mongoose from 'mongoose';

const engineMappingSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['course', 'assessment', 'material'], required: true },
    localId: { type: String, required: true },
    engineId: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false },
);

engineMappingSchema.index({ kind: 1, localId: 1 }, { unique: true });

const EngineMapping = mongoose.model('EngineMapping', engineMappingSchema);

export async function findMapping(kind, localId) {
  return EngineMapping.findOne({ kind, localId }).lean();
}

export async function upsertMapping(kind, localId, engineId, meta = {}) {
  return EngineMapping.findOneAndUpdate(
    { kind, localId },
    { engineId, meta },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}

export default EngineMapping;