/**
 * @openapi
 * /assignments/{assignmentId}/review:
 *   get:
 *     summary: Instructor review buckets (fast track / needs review)
 *     description: >-
 *       Instructor/admin of the course only. Splits every non-draft submission
 *       into fast_track (GRADED/FINALIZED where EVERY answer of the latest
 *       attempt has confidence HIGH) and needs_review (everything else,
 *       including any INSUFFICIENT_EVIDENCE answer - such submissions can
 *       never land in the fast track). Each row carries the student name, the
 *       per-answer AI evaluation summary, aiTotalScore, the assignment's
 *       maxTotalScore, and a decided flag. Filters: studentName (case-
 *       insensitive contains), confidence (submission has at least one answer
 *       with that confidence), approved (true = decided only, false =
 *       pending only). Rows are ordered newest-first; page/limit page through
 *       the concatenated fast_track + needs_review list.
 *     tags: [Assignments & Grading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: studentName
 *         schema:
 *           type: string
 *       - in: query
 *         name: confidence
 *         schema:
 *           type: string
 *           enum: [HIGH, MEDIUM, LOW, INSUFFICIENT_EVIDENCE]
 *       - in: query
 *         name: approved
 *         schema:
 *           type: string
 *           enum: [true, false]
 *     responses:
 *       200:
 *         description: Review buckets with stats
 *       403:
 *         description: Not an instructor/admin of the course
 *       404:
 *         description: Assignment not found
 */

/**
 * @openapi
 * /assignments/{assignmentId}/common-mistakes:
 *   get:
 *     summary: Aggregated misconceptions across the assignment's submissions
 *     description: >-
 *       Instructor/admin only. Groups every misconception from the AI
 *       evaluations of this assignment by code, each with the affected
 *       student count, the percentage of reviewed submissions, and the
 *       affected student ids (ready for the AFFECTED_STUDENTS remedial
 *       audience). Sorted most widespread first. Designed to be fetched
 *       before opening individual submissions.
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
 *         description: Misconception aggregates
 */

/**
 * @openapi
 * /assignments/{assignmentId}/bulk-approve:
 *   post:
 *     summary: Bulk approve fast-track submissions (all-or-nothing)
 *     description: >-
 *       Body { submissionIds: [...] }. Every id must currently be in the
 *       fast-track bucket (GRADED, every answer HIGH, not already decided);
 *       otherwise 400 NOT_FAST_TRACK_ELIGIBLE and NOTHING is approved. On
 *       success each submission gets one final grade per answer (AI values,
 *       decision APPROVED), moves to FINALIZED, and exactly one audit row is
 *       written per submission preserving the original AI score.
 *     tags: [Assignments & Grading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [submissionIds]
 *             properties:
 *               submissionIds:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Approved submission ids
 *       400:
 *         description: NOT_FAST_TRACK_ELIGIBLE (nothing approved)
 *       403:
 *         description: Not an instructor/admin of the course
 */

/**
 * @openapi
 * /submissions/{submissionId}/approve:
 *   post:
 *     summary: Approve the submission (AI scores become the final grades)
 *     description: >-
 *       Instructor/admin only, GRADED submissions only (409 otherwise). Every
 *       answer of the latest attempt must have an AI evaluation. Creates one
 *       final grade per answer copying the AI score/feedback (decision
 *       APPROVED), moves the submission to FINALIZED and writes an audit row
 *       with the original AI total next to the final total. The immutable
 *       ai_evaluations rows are never touched.
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
 *         description: Submission FINALIZED (APPROVED)
 *       409:
 *         description: Submission not GRADED, or review not ready
 */

/**
 * @openapi
 * /submissions/{submissionId}/edit:
 *   post:
 *     summary: Edit the final score (instructor override)
 *     description: >-
 *       Body { score, feedback? } - a submission-level total that cannot
 *       exceed the assignment's maxTotalScore (422 otherwise). Records an
 *       EDITED final grade keeping the AI original alongside, moves the
 *       submission to FINALIZED and writes an audit row. GRADED submissions
 *       only (409 otherwise); ai_evaluations stay byte-identical.
 *     tags: [Assignments & Grading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [score]
 *             properties:
 *               score:
 *                 type: number
 *               feedback:
 *                 type: string
 *     responses:
 *       200:
 *         description: Submission FINALIZED (EDITED)
 *       409:
 *         description: Submission not GRADED
 *       422:
 *         description: Score above the assignment total
 */

/**
 * @openapi
 * /submissions/{submissionId}/reject:
 *   post:
 *     summary: Reject and grade manually from scratch
 *     description: >-
 *       Body { score, feedback? } - the instructor's manual evaluation
 *       replaces the AI output (decision REJECTED_MANUAL). Same rules as
 *       edit: GRADED only, score within the assignment total, audit row with
 *       both values, ai_evaluations untouched.
 *     tags: [Assignments & Grading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [score]
 *             properties:
 *               score:
 *                 type: number
 *               feedback:
 *                 type: string
 *     responses:
 *       200:
 *         description: Submission FINALIZED (REJECTED_MANUAL)
 *       409:
 *         description: Submission not GRADED
 */

/**
 * @openapi
 * /submissions/{submissionId}/request-resubmission:
 *   post:
 *     summary: Ask the student to resubmit
 *     description: >-
 *       Body { reason } - the reason is mandatory; missing or blank returns
 *       422 REASON_REQUIRED. GRADED submissions only (409 otherwise). Moves
 *       the submission to RESUBMISSION_REQUESTED, creates the next attempt
 *       row immediately (so new autosaves never overwrite the retained old
 *       attempt) and writes an audit row with the reason. All resubmission
 *       flows halt when the assignment is closed (student submits then get
 *       409 ASSIGNMENT_CLOSED).
 *     tags: [Assignments & Grading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Submission RESUBMISSION_REQUESTED (new attempt opened)
 *       409:
 *         description: Submission not GRADED
 *       422:
 *         description: REASON_REQUIRED
 */