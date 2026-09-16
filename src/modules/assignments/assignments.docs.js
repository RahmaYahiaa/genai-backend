/**
 * @openapi
 * components:
 *   tags:
 *     - name: Assignments & Grading
 *       description: >-
 *         Instructor-authored assignments with AI grading and instructor approval.
 *         Institutional courses only - personal courses get 403
 *         FEATURE_NOT_AVAILABLE_FOR_PERSONAL_COURSE on every endpoint.
 *   schemas:
 *     Assignment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         courseId:
 *           type: string
 *         createdBy:
 *           type: string
 *         title:
 *           type: string
 *         status:
 *           type: string
 *           enum: [DRAFT, OPEN, CLOSED]
 *         showGradeToStudent:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     AssignmentQuestion:
 *       type: object
 *       description: >-
 *         Instructor view includes modelAnswer and rubricText. These two fields
 *         are never serialized into any student-facing DTO.
 *       properties:
 *         id:
 *           type: string
 *         assignmentId:
 *           type: string
 *         orderIndex:
 *           type: integer
 *         questionText:
 *           type: string
 *         topicId:
 *           type: string
 *         maxScore:
 *           type: number
 *         modelAnswer:
 *           type: string
 *           nullable: true
 *         rubricText:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /courses/{courseId}/assignments:
 *   post:
 *     summary: Create an assignment (DRAFT)
 *     description: >-
 *       Creates a draft assignment on an institutional course. Only course
 *       instructors and the institution admin are allowed. Personal courses
 *       and individual accounts receive 403
 *       FEATURE_NOT_AVAILABLE_FOR_PERSONAL_COURSE.
 *     tags: [Assignments & Grading]
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
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 200
 *     responses:
 *       201:
 *         description: Assignment created as DRAFT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Assignment'
 *       403:
 *         description: Not allowed (institutional-only feature or insufficient role)
 *       404:
 *         description: Course not found or out of scope
 *   get:
 *     summary: List course assignments
 *     description: Lists the course assignments (instructors and institution admin only) with paging and an optional status filter.
 *     tags: [Assignments & Grading]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, OPEN, CLOSED]
 *     responses:
 *       200:
 *         description: Paginated assignments
 */

/**
 * @openapi
 * /assignments/{assignmentId}:
 *   get:
 *     summary: Instructor assignment detail
 *     description: >-
 *       Full instructor view of an assignment including its questions with
 *       modelAnswer and rubricText. Instructor/admin of the course only;
 *       out-of-scope ids return 404.
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
 *         description: Assignment with questions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Assignment'
 *                     - type: object
 *                       properties:
 *                         questions:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/AssignmentQuestion'
 *       404:
 *         description: Assignment not found or out of scope
 *   patch:
 *     summary: Update assignment title
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
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated assignment
 *       404:
 *         description: Assignment not found or out of scope
 */

/**
 * @openapi
 * /assignments/{assignmentId}/questions:
 *   post:
 *     summary: Add a question
 *     description: >-
 *       Adds a question. topicId is required and must belong to the assignment's
 *       course (422 otherwise) because every grading result becomes learning
 *       evidence tied to that topic. maxScore must be greater than 0.
 *       modelAnswer and rubricText are free text, instructor-only.
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
 *             required: [questionText, maxScore]
 *             properties:
 *               questionText:
 *                 type: string
 *               topicId:
 *                 type: string
 *               maxScore:
 *                 type: number
 *               orderIndex:
 *                 type: integer
 *               modelAnswer:
 *                 type: string
 *                 nullable: true
 *               rubricText:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Question created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AssignmentQuestion'
 *       422:
 *         description: Missing or invalid topicId
 */

/**
 * @openapi
 * /assignments/{assignmentId}/questions/{questionId}:
 *   patch:
 *     summary: Update a question
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
 *             properties:
 *               questionText:
 *                 type: string
 *               topicId:
 *                 type: string
 *               maxScore:
 *                 type: number
 *               orderIndex:
 *                 type: integer
 *               modelAnswer:
 *                 type: string
 *                 nullable: true
 *               rubricText:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Updated question
 *       404:
 *         description: Question not found
 *   delete:
 *     summary: Delete a question
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
 *     responses:
 *       200:
 *         description: Question deleted
 *       404:
 *         description: Question not found
 */

/**
 * @openapi
 * /assignments/{assignmentId}/publish:
 *   post:
 *     summary: Publish the assignment (DRAFT to OPEN)
 *     description: >-
 *       Requires at least one question (422 otherwise). Invalid transitions
 *       return 409. There are no due dates - OPEN/CLOSED is manual only.
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
 *         description: Assignment is OPEN
 *       409:
 *         description: Invalid status transition
 *       422:
 *         description: Assignment has no questions
 */

/**
 * @openapi
 * /assignments/{assignmentId}/close:
 *   post:
 *     summary: Close the assignment (OPEN to CLOSED)
 *     description: Closing blocks student submissions and halts all resubmission flows.
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
 *         description: Assignment is CLOSED
 *       409:
 *         description: Invalid status transition
 */

/**
 * @openapi
 * /assignments/{assignmentId}/open:
 *   post:
 *     summary: Reopen the assignment (CLOSED to OPEN)
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
 *         description: Assignment is OPEN again
 *       409:
 *         description: Invalid status transition
 */

/**
 * @openapi
 * /assignments/{assignmentId}/grade-visibility:
 *   patch:
 *     summary: Toggle whether students see their final grades
 *     description: >-
 *       Allowed at any time (before publish, after publish, mid-review). Every
 *       toggle writes an audit-log row. Visibility is evaluated per request at
 *       read time, so turning it off hides grades immediately.
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
 *             required: [showGradeToStudent]
 *             properties:
 *               showGradeToStudent:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated assignment
 *       404:
 *         description: Assignment not found or out of scope
 */