/**
 * OpenAPI documentation for the Courses & Enrollment module
 * (institutional courses, personal learning spaces, topics, staff, enrollments).
 * Docs are kept separate from routing logic.
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     LearningObjective:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         code:
 *           type: string
 *           nullable: true
 *           example: LO-1
 *         description:
 *           type: string
 *           example: Explain BFS traversal order and its complexity
 *     CourseTopic:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
 *           example: Graph Traversal
 *         description:
 *           type: string
 *           nullable: true
 *         order:
 *           type: integer
 *         learningObjectives:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/LearningObjective'
 *         prerequisiteTopicIds:
 *           type: array
 *           items:
 *             type: string
 *     CourseStaffMember:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *         role:
 *           type: string
 *           enum: [instructor, teaching_assistant]
 *         addedBy:
 *           type: string
 *           nullable: true
 *         addedAt:
 *           type: string
 *           format: date-time
 *     Course:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         institutionId:
 *           type: string
 *           nullable: true
 *           description: Null for personal courses.
 *         isPersonal:
 *           type: boolean
 *           description: True when the course is an individual learner's private learning space.
 *         ownerId:
 *           type: string
 *           nullable: true
 *           description: Set for personal courses.
 *         title:
 *           type: string
 *         code:
 *           type: string
 *           nullable: true
 *         description:
 *           type: string
 *           nullable: true
 *         departmentId:
 *           type: string
 *           nullable: true
 *         semesterId:
 *           type: string
 *           nullable: true
 *         topics:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CourseTopic'
 *         staff:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CourseStaffMember'
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *     CreateCourseRequest:
 *       type: object
 *       required: [title]
 *       properties:
 *         title:
 *           type: string
 *         code:
 *           type: string
 *           description: Institutional courses only; unique within the institution.
 *         description:
 *           type: string
 *         departmentId:
 *           type: string
 *         semesterId:
 *           type: string
 *     UpdateCourseRequest:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         title:
 *           type: string
 *         code:
 *           type: string
 *           nullable: true
 *         description:
 *           type: string
 *           nullable: true
 *         departmentId:
 *           type: string
 *           nullable: true
 *         semesterId:
 *           type: string
 *           nullable: true
 *         isActive:
 *           type: boolean
 *     TopicRequest:
 *       type: object
 *       required: [title]
 *       properties:
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         order:
 *           type: integer
 *         learningObjectives:
 *           type: array
 *           items:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                 description:
 *                   type: string
 *         prerequisiteTopicIds:
 *           type: array
 *           items:
 *             type: string
 *           description: Topic ids in the same course only.
 *     Enrollment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         courseId:
 *           type: string
 *         student:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             firstName:
 *               type: string
 *             lastName:
 *               type: string
 *             email:
 *               type: string
 *         enrolledBy:
 *           type: string
 *           nullable: true
 *         enrolledAt:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /courses:
 *   post:
 *     summary: Create a course (institution admin) or a personal course (individual student)
 *     description: |
 *       Institution admins create institutional courses scoped to their own institution.
 *       Individual learners (accountType=individual) create personal learning spaces;
 *       institutional students cannot create courses.
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCourseRequest'
 *     responses:
 *       201:
 *         description: Course created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Course'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *   get:
 *     summary: List courses (role-scoped)
 *     description: Admin sees institution courses, instructor sees staffed courses, student sees enrolled + personal courses.
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search in title/code.
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
 *     responses:
 *       200:
 *         description: Courses page
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Course'
 *                 meta:
 *                   type: object
 */

/**
 * @openapi
 * /courses/{courseId}:
 *   get:
 *     summary: Get a course (same-institution admin, course staff, enrolled student, personal owner)
 *     tags: [Courses]
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
 *         description: The course
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Course'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     summary: Update a course (same-institution admin, course staff, personal owner)
 *     tags: [Courses]
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
 *             $ref: '#/components/schemas/UpdateCourseRequest'
 *     responses:
 *       200:
 *         description: Updated course
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @openapi
 * /courses/{courseId}/topics:
 *   post:
 *     summary: Add a topic (admin/staff/personal owner)
 *     description: Topics carry learning objectives and intra-course prerequisites.
 *     tags: [Courses]
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
 *             $ref: '#/components/schemas/TopicRequest'
 *     responses:
 *       201:
 *         description: Topic created
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @openapi
 * /courses/{courseId}/topics/{topicId}:
 *   patch:
 *     summary: Update a topic
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: topicId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TopicRequest'
 *     responses:
 *       200:
 *         description: Updated topic
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Delete a topic (also removed from other topics prerequisites)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: topicId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @openapi
 * /courses/{courseId}/staff:
 *   post:
 *     summary: Add a staff member (institution admin)
 *     description: Target user must be an instructor of the same institution and not already staff.
 *     tags: [Courses]
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
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [instructor, teaching_assistant]
 *                 default: instructor
 *     responses:
 *       201:
 *         description: Staff member added
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @openapi
 * /courses/{courseId}/staff/{userId}:
 *   delete:
 *     summary: Remove a staff member (institution admin)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Removed
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @openapi
 * /courses/{courseId}/enroll:
 *   post:
 *     summary: Enroll in a course (student self-enroll, or admin enrolls a student)
 *     description: >-
 *       Institutional courses only. Students self-enroll (must belong to the course
 *       institution); admins pass studentId. Individual learners cannot enroll in
 *       institutional courses and personal courses do not use enrollments.
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               studentId:
 *                 type: string
 *                 description: Required for admins only.
 *     responses:
 *       201:
 *         description: Enrolled
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */

/**
 * @openapi
 * /courses/{courseId}/enroll/{studentId}:
 *   delete:
 *     summary: Drop a student enrollment (institution admin)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dropped
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @openapi
 * /courses/{courseId}/enrollments:
 *   get:
 *     summary: List course enrollments (institution admin, course staff)
 *     tags: [Courses]
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
 *     responses:
 *       200:
 *         description: Enrollments page with student mini-profiles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Enrollment'
 *                 meta:
 *                   type: object
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */