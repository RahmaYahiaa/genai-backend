/**
 * OpenAPI documentation for the practice loop (AI-generated practice questions
 * feeding structured learning evidence). Docs are kept separate from routing.
 */

/**
 * @openapi
 * components:
 *   tags:
 *     - name: Practice Loop
 *       description: AI-generated practice on a topic; every answer writes structured learning evidence
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     PracticeAnswerEvaluation:
 *       type: object
 *       properties:
 *         correctness:
 *           type: string
 *           enum: [incorrect, partial, correct]
 *         score:
 *           type: number
 *           description: Derived deterministically by the backend (1 / 0.5 / 0) - never output by the LLM.
 *         confidence:
 *           type: number
 *           nullable: true
 *         misconceptions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 nullable: true
 *               description:
 *                 type: string
 *         feedback:
 *           type: string
 *         model:
 *           type: string
 *         evaluatedAt:
 *           type: string
 *           format: date-time
 *     PracticeQuestion:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         prompt:
 *           type: string
 *         difficulty:
 *           type: string
 *           enum: [easy, medium, hard]
 *         generatedBy:
 *           type: string
 *     PracticeSession:
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
 *         status:
 *           type: string
 *           enum: [in_progress, completed, abandoned]
 *         questions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PracticeQuestion'
 *         answers:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               questionId:
 *                 type: string
 *               responseText:
 *                 type: string
 *               evaluation:
 *                 $ref: '#/components/schemas/PracticeAnswerEvaluation'
 *               evidenceId:
 *                 type: string
 *                 nullable: true
 *               answeredAt:
 *                 type: string
 *                 format: date-time
 *         questionCount:
 *           type: integer
 *         answeredCount:
 *           type: integer
 *         startedAt:
 *           type: string
 *           format: date-time
 *         completedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 */

/**
 * @openapi
 * /courses/{courseId}/practice/sessions:
 *   post:
 *     summary: Start an AI practice session on a topic (student owner only)
 *     tags: [Practice Loop]
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
 *               questionsCount:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 default: 3
 *     responses:
 *       201:
 *         description: Practice session created with generated questions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PracticeSession'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @openapi
 * /courses/{courseId}/practice/sessions/{practiceSessionId}:
 *   get:
 *     summary: Get one practice session with questions, answers, and evaluations (owner only)
 *     tags: [Practice Loop]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: practiceSessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The practice session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PracticeSession'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @openapi
 * /courses/{courseId}/practice/sessions/{practiceSessionId}/answers:
 *   post:
 *     summary: Answer a practice question - AI evaluates and writes learning evidence (owner only)
 *     description: >-
 *       The AI classifies the answer only; the score is derived deterministically
 *       and a structured learning_evidence row (sourceType "practice") is
 *       written immediately. Completing all questions auto-completes the
 *       session. The evidence feeds the deterministic learner model.
 *     tags: [Practice Loop]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: practiceSessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [questionId, content]
 *             properties:
 *               questionId:
 *                 type: string
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *     responses:
 *       201:
 *         description: Evaluation result and the created structured evidence
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
 *                     session:
 *                       $ref: '#/components/schemas/PracticeSession'
 *                     answer:
 *                       type: object
 *                       properties:
 *                         questionId:
 *                           type: string
 *                         evaluation:
 *                           $ref: '#/components/schemas/PracticeAnswerEvaluation'
 *                         evidence:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             sourceType:
 *                               type: string
 *                             correctness:
 *                               type: string
 *                             score:
 *                               type: number
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */