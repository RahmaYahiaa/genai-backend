import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess, sendCreated } from '../../shared/http/api-response.js';
import { toPublicInstitution } from './institution.model.js';

export function createAcademicStructureController({ academicStructureService }) {
  const getMyInstitution = asyncHandler(async (req, res) => {
    const institution = await academicStructureService.getInstitution(req.user.institutionId);
    sendSuccess(res, { data: toPublicInstitution(institution) });
  });

  const updateInstitution = asyncHandler(async (req, res) => {
    const institution = await academicStructureService.updateInstitution(
      req.user,
      req.validated.params.institutionId,
      req.validated.body,
    );
    sendSuccess(res, { data: institution });
  });

  const createUnit = asyncHandler(async (req, res) => {
    const unit = await academicStructureService.createUnit(req.user, {
      ...req.validated.body,
      parentId: req.validated.body.parentId ?? null,
    });
    sendCreated(res, unit);
  });

  const listUnits = asyncHandler(async (req, res) => {
    const units = await academicStructureService.listUnits(
      req.user,
      req.validated.params.institutionId,
      {
        type: req.validated.query.type,
        parentId: req.validated.query.parentId,
      },
    );
    sendSuccess(res, { data: units });
  });

  const updateUnit = asyncHandler(async (req, res) => {
    const unit = await academicStructureService.updateUnit(
      req.user,
      req.validated.params.unitId,
      req.validated.body,
    );
    sendSuccess(res, { data: unit });
  });

  const deleteUnit = asyncHandler(async (req, res) => {
    const deleted = await academicStructureService.deleteUnit(
      req.user,
      req.validated.params.unitId,
    );
    sendSuccess(res, { data: { deleted } });
  });

  return { getMyInstitution, updateInstitution, createUnit, listUnits, updateUnit, deleteUnit };
}