/**
 * @openapi
 * /courses/{courseId}/remedial:
 *   post:
 *     summary: Generate a remedial content DRAFT with AI (never auto-published)
 *     description: >-
 *       Instructor/admin of the course only. Two origins: FROM_MISCONCEPTION
 *       (assignmentId + misconceptionCode, verified against the assignment's
 *       ai_evaluations; the response also carries the currently affected
 *       student ids) or STANDALONE (topicId belonging to the course, optional
 *       instructor instructions). The content is generated ONLY from trusted
 *       retrieved course material; with no retrievable material the endpoint
 *       returns 422 INSUFFICIENT_EVIDENCE instead of guessing. The result is
 *       always created in DRAFT status - publishing is a separate explicit
 *       action, and nothing is ever auto-published.
 *     tags: [Remedial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required: [origin, assignmentId, misconceptionCode, contentType]
 *                 properties:
 *                   origin:
 *                     type: string
 *                     enum: [FROM_MISCONCEPTION]
 *                   assignmentId:
 *                     type: string
 *                   misconceptionCode:
 *                     type: string
 *                   contentType:
 *                     type: string
 *                     enum: [FOCUSED_EXPLANATION_WITH_EXAMPLE, EXTRA_PRACTICE_QUESTIONS]
 *               - type: object
 *                 required: [origin, topicId, contentType]
 *                 properties:
 *                   origin:
 *                     type: string
 *                     enum: [STANDALONE]
 *                   topicId:
 *                     type: string
 *                   contentType:
 *                     type: string
 *                     enum: [FOCUSED_EXPLANATION_WITH_EXAMPLE, EXTRA_PRACTICE_QUESTIONS]
 *                   instructions:
 *                     type: string
 *     responses:
 *       200:
 *         description: Draft created (status DRAFT) with generation metadata
 *       403:
 *         description: Not an instructor/admin of the course
 *       422:
 *         description: Unknown misconception/topic, or no trusted material (INSUFFICIENT_EVIDENCE)
 *       502:
 *         description: AI provider failed to produce valid output
 *
 *   get:
 *     summary: List the course's remedial content (instructor view)
 *     description: >-
 *       Instructor/admin only. Full documents including audience and
 *       generation metadata. Optional status filter (DRAFT|PUBLISHED).
 *     tags: [Remedial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PUBLISHED]
 *     responses:
 *       200:
 *         description: Remedial content list with total
 */

/**
 * @openapi
 * /courses/{courseId}/remedial/mine:
 *   get:
 *     summary: Student view of remedial content published to them
 *     description: >-
 *       Enrolled institutional students only. Returns only PUBLISHED content
 *       whose audience includes the caller: ALL_STUDENTS, or the student id
 *       was snapshotted into audienceStudentIds at publish time (AFFECTED or
 *       SELECTED). The student shape never exposes audience lists,
 *       misconception metadata, generation metadata, or drafts.
 *     tags: [Remedial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Remedial content addressed to the caller
 *       403:
 *         description: Non-student or personal (individual) account
 *       404:
 *         description: Not enrolled in the course
 */

/**
 * @openapi
 * /courses/{courseId}/remedial/{remedialId}:
 *   get:
 *     summary: Instructor detail of one remedial content
 *     tags: [Remedial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: remedialId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Full remedial document
 *       404:
 *         description: Not found or out of scope
 *
 *   patch:
 *     summary: Edit a DRAFT (title/body)
 *     description: >-
 *       Instructor/admin only. Drafts only - editing an already published
 *       item returns 409; publish is final. At least one of title/body must
 *       be present.
 *     tags: [Remedial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: remedialId
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
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated draft
 *       409:
 *         description: Already published
 */

/**
 * @openapi
 * /courses/{courseId}/remedial/{remedialId}/publish:
 *   post:
 *     summary: Publish a DRAFT to an explicit audience
 *     description: >-
 *       Instructor/admin only; publishing twice returns 409. The audience is
 *       resolved and snapshotted AT PUBLISH TIME: ALL_STUDENTS (every
 *       enrolled student, evaluated at read time), AFFECTED_STUDENTS (only
 *       for misconception-sourced content - resolved from the assignment's
 *       ai_evaluations for that misconception code) or SELECTED_STUDENTS
 *       (studentIds required; every id must be enrolled in the course, else
 *       422). Remedial content is never published automatically anywhere in
 *       the system.
 *     tags: [Remedial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: remedialId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [audienceType]
 *             properties:
 *               audienceType:
 *                 type: string
 *                 enum: [ALL_STUDENTS, AFFECTED_STUDENTS, SELECTED_STUDENTS]
 *               studentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Published with the resolved audience
 *       409:
 *         description: Already published
 *       422:
 *         description: Invalid audience for this content or non-enrolled student id
 */