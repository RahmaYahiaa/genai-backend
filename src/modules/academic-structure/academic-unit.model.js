import mongoose from 'mongoose';
import { ACADEMIC_UNIT_TYPES } from '../../config/constants.js';

/**
 * Enforced hierarchy order: a unit may only be nested under a unit of a
 * strictly higher (earlier) rank, e.g. department under faculty, semester
 * under program.
 */
export const UNIT_TYPE_RANKS = {
  [ACADEMIC_UNIT_TYPES.FACULTY]: 1,
  [ACADEMIC_UNIT_TYPES.DEPARTMENT]: 2,
  [ACADEMIC_UNIT_TYPES.PROGRAM]: 3,
  [ACADEMIC_UNIT_TYPES.SEMESTER]: 4,
};

const ancestorSchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicUnit', required: true },
    type: { type: String, enum: Object.values(ACADEMIC_UNIT_TYPES), required: true },
    name: { type: String, required: true },
  },
  { _id: false },
);

/**
 * One self-referencing collection for the whole academic tree
 * (faculty -> department -> program -> semester) with a materialized
 * ancestors path for cheap institution/branch scope checks.
 */
const academicUnitSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(ACADEMIC_UNIT_TYPES),
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    code: { type: String, trim: true, maxlength: 50, default: null },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicUnit', default: null },
    // Materialized path from root to parent (excludes the unit itself).
    ancestors: { type: [ancestorSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

academicUnitSchema.index({ institutionId: 1, type: 1, parentId: 1, name: 1 }, { unique: true });
academicUnitSchema.index({ institutionId: 1, 'ancestors.id': 1 });

const AcademicUnit = mongoose.model('AcademicUnit', academicUnitSchema);

/** Maps a lean unit document to the public API shape. */
export function toPublicUnit(unit) {
  return {
    id: unit._id.toString(),
    institutionId: unit.institutionId.toString(),
    type: unit.type,
    name: unit.name,
    code: unit.code ?? null,
    parentId: unit.parentId ? unit.parentId.toString() : null,
    ancestors: (unit.ancestors ?? []).map((ancestor) => ({
      id: ancestor.id.toString(),
      type: ancestor.type,
      name: ancestor.name,
    })),
    isActive: unit.isActive,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  };
}

export default AcademicUnit;