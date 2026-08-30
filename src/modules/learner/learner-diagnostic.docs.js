/**
 * OpenAPI documentation for the Learner flow module (Stage B: learner
 * profiles, diagnostic assessments, AI answer evaluation, and structured
 * learning evidence). Docs are kept separate from routing logic.
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     LearnerProfile:
 *       type: object
 *       description: >-
 *         Per-student per-course learning profile, created lazily when the
 *         student first enters the learning flow of the course.
 *       properties:
 *         id:
 *           type: string
 *         studentId:
 *           type: string
 *         courseId:
 *           type: string
 *         status:
 *           type: string
 *         lastActivityAt:
 *           type: string
 *           format: date-time
 *         initializedAt:
 *           type: string
 *           format: date-time
 *     DiagnosticQuestion:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         topicId:
 *           type: string
 *         objectiveCode:
 *           type: string
 *           nullable: true
 *         prompt:
 *           type: string
 *         difficulty:
 *           type: string
 *           enum: [easy, medium, hard]
 *         generatedBy:
 *           type: string
 *     DiagnosticAnswer:
 *       type: object
 *       properties:
 *         questionId:
 *           type: string
 *         responseMode:
 *           type: string
 *           enum: [text, voice]
 *         responseText:
 *           type: string
 *         transcript:
 *           type: string
 *           nullable: true
 *         evaluation:
 *           type: object
 *           properties:
 *             correctness:
 *               type: string
 *               enum: [incorrect, partial, correct]
 *             score:
 *               type: number
 *               description: Derived deterministically by the backend (correct=1, partial=0.5, incorrect=0) - never computed by the LLM.
 *             confidence:
 *               type: number
 *               nullable: true
 *             misconceptions:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   code:
 *                     type: string
 *                     nullable: true
 *                   description:
 *                     type: string
 *             feedback:
 *               type: string
 *             model:
 *               type: string
 *             evaluatedAt:
 *               type: string
 *               format: date-time
 *         evidenceId:
 *           type: string
 *         answeredAt:
 *           type: string
 *           format: date-time
 *     DiagnosticAssessment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         studentId:
 *           type: string
 *         courseId:
 *           type: string
 *         status:
 *           type: string
 *           enum: [in_progress, completed, abandoned]
 *         targetTopicIds:
 *           type: array
 *           items:
 *             type: string
 *         questions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DiagnosticQuestion'
 *         answers:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DiagnosticAnswer'
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
 *     StartDiagnosticRequest:
 *       type: object
 *       properties:
 *         topicIds:
 *           type: array
 *           items:
 *             type: string
 *           description: Defaults to all course topics.
 *         questionsPerTopic:
 *           type: integer
 *           default: 2
 *           minimum: 1
 *           maximum: 5
 *     SubmitAnswerRequest:
 *       type: object
 *       required: [questionId, content]
 *       properties:
 *         questionId:
 *           type: string
 *         responseMode:
 *           type: string
 *           enum: [text, voice]
 *           default: text
 *         content:
 *           type: string
 *           description: The answer text (or ignored for voice when a transcript is produced).
 *         audioBase64:
 *           type: string
 *           description: Required when responseMode=voice.
 *         audioMimeType:
 *           type: string
 *     LearningEvidence:
 *       type: object
 *       description: >-
 *         Structured evidence record. Generated feedback prose is NOT part of
 *         evidence; mastery is never stored here (derived later by rules).
 *       properties:
 *         id:
 *           type: string
 *         studentId:
 *           type: string
 *         courseId:
 *           type: string
 *         topicId:
 *           type: string
 *         objectiveCode:
 *           type: string
 *           nullable: true
 *         sourceType:
 *           type: string
 *           enum: [diagnostic, practice, assessment, reassessment, assignment]
 *         assessmentId:
 *           type: string
 *         questionId:
 *           type: string
 *         correctness:
 *           type: string
 *           enum: [incorrect, partial, correct]
 *         score:
 *           type: number
 *         misconceptionCodes:
 *           type: array
 *           items:
 *             type: string
 *         evaluationModel:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /courses/{courseId}/learner-profile:
 *   get:
 *     summary: Get or initialize the caller learner profile (student only)
 *     description: >-
 *       Owner-only learning flow: enrolled institutional students and personal
 *       space owners. The profile is created lazily on first access.
 *     tags: [Learner Flow]
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
 *         description: The learner profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/LearnerProfile'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @openapi
 * /courses/{courseId}/diagnostics:
 *   post:
 *     summary: Start a diagnostic assessment (student only)
 *     description: >-
 *       Generates questions with the configured LLM provider against the
 *       course topics and learning objectives. LLM output is validated with
 *       Zod; invalid model output yields 502.
 *     tags: [Learner Flow]
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
 *             $ref: '#/components/schemas/StartDiagnosticRequest'
 *     responses:
 *       201:
 *         description: Assessment created (in_progress) with generated questions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DiagnosticAssessment'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       502:
 *         description: AI provider failure or invalid model output
 */

/**
 * @openapi
 * /courses/{courseId}/diagnostics/{diagnosticId}:
 *   get:
 *     summary: Get a diagnostic assessment with answers and evaluations (owner only)
 *     tags: [Learner Flow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: diagnosticId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The assessment
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DiagnosticAssessment'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @openapi
 * /courses/{courseId}/diagnostics/{diagnosticId}/answers:
 *   post:
 *     summary: Submit an answer and receive the AI evaluation (owner only)
 *     description: >-
 *       Text answers are evaluated directly; voice answers are transcribed by
 *       the transcription provider first. Each answer produces one structured
 *       learning evidence record (returned as evidenceId). The score is
 *       derived deterministically - the LLM only classifies correctness.
 *     tags: [Learner Flow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: diagnosticId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitAnswerRequest'
 *     responses:
 *       201:
 *         description: Evaluation result and updated assessment status
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       502:
 *         description: AI provider failure or invalid model output
 */

/**
 * @openapi
 * /courses/{courseId}/diagnostics/{diagnosticId}/evidence:
 *   get:
 *     summary: List the structured learning evidence of an assessment (owner only)
 *     description: Traceability view - every later insight (gaps, mastery) must reference these records.
 *     tags: [Learner Flow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: diagnosticId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Evidence records
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
 *                     $ref: '#/components/schemas/LearningEvidence'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */