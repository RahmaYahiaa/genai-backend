/**
 * OpenAPI documentation for the AI tutor (grounded Q&A over trusted course
 * material). Docs are kept separate from routing logic.
 */

/**
 * @openapi
 * components:
 *   tags:
 *     - name: AI Tutor
 *       description: Grounded tutor Q&A - RAG over the course's own material with citations
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     TutorCitation:
 *       type: object
 *       description: The trusted material chunk a tutor answer claim is grounded in.
 *       properties:
 *         chunkId:
 *           type: string
 *         materialId:
 *           type: string
 *         order:
 *           type: integer
 *         score:
 *           type: number
 *         snippet:
 *           type: string
 *     TutorMessage:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         role:
 *           type: string
 *           enum: [student, tutor]
 *         content:
 *           type: string
 *         grounding:
 *           type: string
 *           enum: [grounded, partially_grounded, insufficient_evidence, unverified]
 *           nullable: true
 *         citations:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TutorCitation'
 *         createdAt:
 *           type: string
 *           format: date-time
 *     TutorSession:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         studentId:
 *           type: string
 *         courseId:
 *           type: string
 *         topicId:
 *           type: string
 *         mode:
 *           type: string
 *           enum: [explanation, worked_example, summary, revision, coding_help, guided_questioning, practice]
 *         status:
 *           type: string
 *           enum: [active, closed]
 *         messages:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TutorMessage'
 *         messageCount:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /courses/{courseId}/tutor/sessions:
 *   post:
 *     summary: Open an AI tutor session on a topic (student owner only)
 *     tags: [AI Tutor]
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
 *             required: [topicId]
 *             properties:
 *               topicId:
 *                 type: string
 *               mode:
 *                 type: string
 *                 enum: [explanation, worked_example, summary, revision, coding_help, guided_questioning, practice]
 *                 default: explanation
 *     responses:
 *       201:
 *         description: Tutor session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/TutorSession'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   get:
 *     summary: List the caller's tutor sessions in a course (student owner only)
 *     tags: [AI Tutor]
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
 *         description: Tutor sessions (newest first)
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
 *                     $ref: '#/components/schemas/TutorSession'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @openapi
 * /courses/{courseId}/tutor/sessions/{tutorSessionId}:
 *   get:
 *     summary: Get one tutor session with its full message history (owner only)
 *     tags: [AI Tutor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: tutorSessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The tutor session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/TutorSession'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @openapi
 * /courses/{courseId}/tutor/sessions/{tutorSessionId}/messages:
 *   post:
 *     summary: Ask a question and receive a grounded answer with citations (owner only)
 *     description: >-
 *       Retrieval runs first over the course's own material chunks. With no
 *       sufficiently matching trusted material the request fails with 422
 *       INSUFFICIENT_EVIDENCE (the question is still recorded in the session)
 *       and no answer is generated - the system refuses instead of guessing.
 *     tags: [AI Tutor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: tutorSessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 4000
 *     responses:
 *       201:
 *         description: Grounded tutor answer with citations
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
 *                     sessionId:
 *                       type: string
 *                     message:
 *                       $ref: '#/components/schemas/TutorMessage'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         description: Insufficient trusted evidence to answer
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       enum: [INSUFFICIENT_EVIDENCE]
 *                     message:
 *                       type: string
 */