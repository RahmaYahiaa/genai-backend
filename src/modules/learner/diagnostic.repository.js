import DiagnosticAssessment, { toPublicDiagnostic } from './diagnostic-assessment.model.js';

export async function create(data) {
  return DiagnosticAssessment.create(data);
}

export async function findById(assessmentId) {
  return DiagnosticAssessment.findById(assessmentId).lean();
}

export async function pushAnswer(assessmentId, answer) {
  return DiagnosticAssessment.findByIdAndUpdate(
    assessmentId,
    { $push: { answers: answer } },
    { new: true },
  ).lean();
}

export async function complete(assessmentId) {
  return DiagnosticAssessment.findByIdAndUpdate(
    assessmentId,
    { $set: { status: 'completed', completedAt: new Date() } },
    { new: true },
  ).lean();
}

export { toPublicDiagnostic };