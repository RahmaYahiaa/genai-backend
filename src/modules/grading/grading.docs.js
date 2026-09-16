/**
 * @openapi
 * /assignments/{assignmentId}/questions/{questionId}/preview-evaluation:
 *   post:
 *     summary: Preview the AI evaluation of a trial answer (instructor only)
 *     description: >-
 *       Runs the EXACT grading pipeline used for real student answers - same
 *       source priority (question + max score, then model answer + rubric,
 *       then retrieved excerpts from the course's own materials via the tutor
 *       retrieval service), same prompt, same output schema, same service
 *       function - so the instructor tunes the question and rubric against
 *       identical behavior. The result is NOT persisted as an evaluation.
 *       When no model answer, no rubric and no sufficient retrieved material
 *       exist, the pipeline refuses to fabricate a confident evaluation and
 *       returns confidence INSUFFICIENT_EVIDENCE (such answers are always
 *       routed to mandatory manual review).
 *     tags: [Assignments & Grading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [trialAnswer]
 *             properties:
 *               trialAnswer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Evaluation preview (never persisted)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     score:
 *                       type: number
 *                       nullable: true
 *                     correctness:
 *                       type: string
 *                       nullable: true
 *                       enum: [CORRECT, PARTIAL, INCORRECT]
 *                     confidence:
 *                       type: string
 *                       enum: [HIGH, MEDIUM, LOW, INSUFFICIENT_EVIDENCE]
 *                     feedbackText:
 *                       type: string
 *                     misconceptions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code:
 *                             type: string
 *                           description:
 *                             type: string
 *                     rubricBreakdown:
 *                       nullable: true
 *                     sourcesUsed:
 *                       type: object
 *                       description: Which of question/model_answer/rubric/retrieved chunks were actually available
 *                     modelVersion:
 *                       type: string
 *                     promptVersion:
 *                       type: string
 *                     persisted:
 *                       type: boolean
 *       403:
 *         description: Not an instructor/admin of the course
 *       404:
 *         description: Assignment or question not found
 */

/**
 * @openapi
 * /submissions/{submissionId}:
 *   get:
 *     summary: Full submission detail for instructor review
 *     description: >-
 *       Instructor/admin of the course only. Returns the student's answers
 *       (text + handwritten image URL), the AI evaluation of every answer
 *       (immutable row: score, correctness, confidence, misconceptions,
 *       rubric breakdown, sources used, model/prompt versions), the question
 *       with modelAnswer and rubricText, and the list of prior attempts.
 *       Students receive 403 - never a filtered view.
 *     tags: [Assignments & Grading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Full review detail
 *       403:
 *         description: Caller is not an instructor/admin of the course
 *       404:
 *         description: Submission not found
 */