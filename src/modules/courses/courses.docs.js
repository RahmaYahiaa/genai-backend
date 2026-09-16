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
/**
 * @openapi
 * /courses/catalog:
 *   get:
 *     summary: Browse the institution course catalog (institutional students)
 *     description: >-
 *       Titles-and-metadata catalog of the caller's institution courses so
 *       students can discover electives and request to join. Course content,
 *       topics and staff details are never returned here - access to content
 *       still requires an approved enrollment. Each item carries the caller's
 *       own state: enrolled (already a member) and myRequestStatus
 *       (NONE | PENDING | APPROVED | REJECTED) so the UI can render the right
 *       action. Personal courses are never part of the catalog.
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Case-insensitive filter over title and code
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Catalog page with per-student join state
 *       403:
 *         description: Only institutional students browse the catalog (admins, instructors and individual learners get 403)
 */

/**
 * @openapi
 * /courses/{courseId}/enrollment-request:
 *   post:
 *     summary: Submit an enrollment request for an institutional course (student)
 *     description: >-
 *       The student asks to join a course of their own institution; the
 *       institution admin decides. Rules: institutional students only
 *       (individual learners use personal courses), same institution as the
 *       course, not already enrolled, and one lifetime request per student
 *       per course (duplicate or already-decided requests return 409).
 *       Approval by the admin creates the enrollment.
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional message to the admin explaining the request
 *     responses:
 *       201:
 *         description: Request submitted (status PENDING)
 *       403:
 *         description: Not an institutional student of this course's institution
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Already enrolled or a request already exists
 */

/**
 * @openapi
 * /courses/enrollment-requests/my:
 *   get:
 *     summary: List my enrollment requests (student)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
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
 *         description: My requests (each with its course title/code)
 *       403:
 *         description: Only institutional students have enrollment requests
 */

/**
 * @openapi
 * /courses/enrollment-requests:
 *   get:
 *     summary: Manage the institution enrollment-request queue (admin)
 *     description: >-
 *       All requests for the admin's institution, newest first, with the
 *       student name/email and course title/code embedded. Filter by status;
 *       PENDING is the actionable queue.
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
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
 *         description: Requests page (scoped to the caller institution)
 *       403:
 *         description: Only the institution admin manages requests
 */

/**
 * @openapi
 * /courses/enrollment-requests/{requestId}/decision:
 *   post:
 *     summary: Approve or reject an enrollment request (admin, own institution)
 *     description: >-
 *       Final decision on a PENDING request. APPROVED creates the enrollment
 *       immediately (unless the student was enrolled manually meanwhile - the
 *       request still closes as approved with enrollmentCreated=false).
 *       REJECTED records the reason for the student to see. Decided requests
 *       cannot be decided again (409).
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [decision]
 *             properties:
 *               decision:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *               note:
 *                 type: string
 *                 maxLength: 500
 *                 description: Decision note (rejection reason shown to the student)
 *     responses:
 *       200:
 *         description: Decision recorded (enrollmentCreated true when an enrollment was just created)
 *       403:
 *         description: Only the institution admin decides
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Request already decided
 */