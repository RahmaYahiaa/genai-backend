import {
  EVIDENCE_SOURCE_TYPES,
  SUBMISSION_STATUS,
  FINAL_GRADE_DECISIONS,
} from '../../config/constants.js';

function round2(value) {
  return Math.round(value * 100) / 100;
}

/** Deterministic rule from the FINAL score ratio (no LLM output involved). */
function ratioToCorrectness(ratio) {
  if (ratio >= 0.7) return 'correct';
  if (ratio >= 0.4) return 'partial';
  return 'incorrect';
}

export function createAssignmentEvidenceService({
  courseRepository,
  assignmentQuestionRepository,
  submissionAttemptRepository,
  submissionAnswerRepository,
  finalGradeRepository,
  aiEvaluationRepository,
  evidenceRepository,
}) {
  /**
   * Called once a submission reaches FINALIZED (APPROVED, EDITED or
   * REJECTED_MANUAL). Writes learning_evidence rows from the FINAL score,
   * tied to each question's topic. The latest attempt only: any evidence
   * previously written for the same student+assignment is superseded
   * (deleted and rewritten), so N attempts still yield exactly one
   * evidence set.
   */
  async function writeForFinalized({ submission, assignment }) {
    if (submission.status !== SUBMISSION_STATUS.FINALIZED) {
      return [];
    }
    const course = await courseRepository.findById(assignment.courseId);
    const questions = await assignmentQuestionRepository.listByAssignment(assignment._id);
    const questionById = new Map(questions.map((question) => [String(question._id), question]));
    const maxTotalScore = questions.reduce((sum, question) => sum + question.maxScore, 0);
    if (maxTotalScore === 0) {
      return [];
    }

    await evidenceRepository.deleteBySourceAssignment({
      studentId: submission.studentId,
      assignmentId: assignment._id,
    });

    const attempt = await submissionAttemptRepository.findLatest(submission._id);
    const answers = attempt ? await submissionAnswerRepository.listByAttempt(attempt._id) : [];
    const grades = await finalGradeRepository.listBySubmission(submission._id);
    const evaluations = await aiEvaluationRepository.listBySubmission(submission._id);
    const evaluationByAnswer = new Map(
      evaluations.map((evaluation) => [String(evaluation.answerId), evaluation]),
    );
    const decisionModel = `assignment-final-${String(
      submission.finalDecision ?? FINAL_GRADE_DECISIONS.APPROVED,
    ).toLowerCase()}`;
    const perAnswerGrades = grades.filter((grade) => grade.answerId);
    const rows = [];

    for (const answer of answers) {
      const question = questionById.get(String(answer.questionId));
      if (!question || !question.maxScore) continue;
      const perAnswerGrade = perAnswerGrades.find(
        (grade) => String(grade.answerId) === String(answer._id),
      );
      const ratio = perAnswerGrade
        ? round2(Math.min(1, Math.max(0, perAnswerGrade.finalScore / question.maxScore)))
        : round2(
            Math.min(1, Math.max(0, (submission.finalScoreTotal ?? 0) / maxTotalScore)),
          );
      const evaluation = evaluationByAnswer.get(String(answer._id));
      rows.push({
        studentId: submission.studentId,
        courseId: assignment.courseId,
        topicId: question.topicId,
        objectiveCode: null,
        sourceType: EVIDENCE_SOURCE_TYPES.ASSIGNMENT,
        assessmentId: assignment._id,
        questionId: answer.questionId,
        correctness: ratioToCorrectness(ratio),
        score: ratio,
        misconceptionCodes: (evaluation?.misconceptions ?? []).map(
          (misconception) => misconception.code,
        ),
        evaluationModel: decisionModel,
        institutionId: course?.institutionId ?? null,
        isPersonal: false,
      });
    }

    if (rows.length === 0) {
      return [];
    }
    return evidenceRepository.insertMany(rows);
  }

  return { writeForFinalized };
}