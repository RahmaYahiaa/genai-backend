/**
 * @openapi
 * /assignments/{assignmentId}/answers/{questionId}:
 *   put:
 *     summary: Autosave a student answer draft (idempotent)
 *     description: >-
 *       Student-only. Creates or updates the answer for one question inside the
 *       latest attempt (the submission container is created lazily on the first
 *       autosave as DRAFT / attempt 1). Sending the same payload twice yields
 *       the same state. Allowed only while the assignment is OPEN and the
 *       submission is editable (DRAFT or RESUBMISSION_REQUESTED); otherwise
 *       409 (ASSIGNMENT_CLOSED when the assignment is closed). modelAnswer and
 *       rubricText are never involved in this flow. The payload shape follows
 *       the question type: subjective questions (short_answer, long_answer,
 *       essay, problem_solving) take answerText/imageUrl; objective questions
 *       (multiple_choice, multiple_select, true_false) take selectedOptionIds
 *       (exactly one option for multiple_choice/true_false, any subset for
 *       multiple_select) - mixing the two shapes returns 422.
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
 *             description: At least one of the two fields is required.
 *             properties:
 *               answerText:
 *                 type: string
 *                 nullable: true
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *                 description: Handwritten solutions (e.g. math/physics) referenced by URL.
 *     responses:
 *       200:
 *         description: Answer saved (submission + attempt + answer state)
 *       403:
 *         description: Not an enrolled institutional student (individual accounts get FEATURE_NOT_AVAILABLE_FOR_PERSONAL_COURSE)
 *       404:
 *         description: Assignment or question not found / out of scope
 *       409:
 *         description: Assignment closed (ASSIGNMENT_CLOSED) or submission already submitted
 */

/**
 * @openapi
 * /assignments/{assignmentId}/submit:
 *   post:
 *     summary: Submit the assignment (single endpoint for the whole assignment)
 *     description: >-
 *       Student-only. Marks the latest attempt as submitted (submittedAt) and
 *       moves the submission to SUBMITTED; grading jobs are then produced per
 *       answer. Blocked with 409 ASSIGNMENT_CLOSED when the assignment is
 *       closed; closed assignments halt every flow including resubmissions.
 *       Requires at least one saved answer (422 otherwise). Double submit
 *       returns 409. There are no due dates - only the manual OPEN/CLOSED
 *       toggle.
 *     tags: [Assignments & Grading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Submission is SUBMITTED
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
 *                     id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [DRAFT, SUBMITTED, GRADING, GRADED, RESUBMISSION_REQUESTED, FINALIZED]
 *                     currentAttemptNo:
 *                       type: integer
 *                     submittedAt:
 *                       type: string
 *                       format: date-time
 *       409:
 *         description: Assignment closed or already submitted
 *       422:
 *         description: No answers saved yet
 */

/**
 * @openapi
 * /assignments/{assignmentId}/result:
 *   get:
 *     summary: Student result of the assignment (visibility evaluated per request)
 *     description: >-
 *       Student-only. Returns the final grade ONLY when a final decision
 *       exists (APPROVED/EDITED/REJECTED_MANUAL) AND the assignment's
 *       showGradeToStudent is true evaluated at request time - toggling
 *       visibility hides grades immediately. Otherwise a "not available yet"
 *       state is returned with a stable reason: NOT_SUBMITTED, NOT_FINALIZED,
 *       RESUBMISSION_REQUESTED (with the instructor's reason and the previous
 *       attempt's answers pre-filled) or GRADES_HIDDEN. Never returns the
 *       audit log, the AI-vs-final comparison, the model answer, or the
 *       rubric.
 *     tags: [Assignments & Grading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Result or an explicit not-available state
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
 *                     available:
 *                       type: boolean
 *                     reason:
 *                       type: string
 *                       nullable: true
 *                       enum: [NOT_SUBMITTED, NOT_FINALIZED, RESUBMISSION_REQUESTED, GRADES_HIDDEN]
 *                     result:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         submissionId:
 *                           type: string
 *                         finalScoreTotal:
 *                           type: number
 *                         finalFeedback:
 *                           type: string
 *                           nullable: true
 *                         finalDecision:
 *                           type: string
 *                           enum: [APPROVED, EDITED, REJECTED_MANUAL]
 *                         answers:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               questionId:
 *                                 type: string
 *                               finalScore:
 *                                 type: number
 *                               finalFeedback:
 *                                 type: string
 *                                 nullable: true
 *       403:
 *         description: Not an enrolled institutional student
 *       404:
 *         description: Assignment not found or out of scope
 */
