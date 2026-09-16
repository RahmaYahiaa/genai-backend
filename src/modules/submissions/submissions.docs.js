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
 *       rubricText are never involved in this flow.
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