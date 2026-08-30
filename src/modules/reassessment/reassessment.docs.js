/**
 * OpenAPI documentation for reassessment & learning gain (flow steps 17-20).
 * Docs are kept separate from routing logic.
 */

/**
 * @openapi
 * components:
 *   tags:
 *     - name: Reassessment & Gain
 *       description: Second-chance assessments on weak topics and the deterministic before/after learning-gain report
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     ReassessmentSession:
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
 *         masteryLevelBefore:
 *           type: string
 *           enum: [no_evidence, beginner, intermediate, advanced, mastered]
 *           description: Deterministic mastery snapshot taken when the session started.
 *         status:
 *           type: string
 *           enum: [in_progress, completed, abandoned]
 *         questions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               prompt:
 *                 type: string
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard]
 *               generatedBy:
 *                 type: string
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
 *                 type: object
 *                 properties:
 *                   correctness:
 *                     type: string
 *                     enum: [incorrect, partial, correct]
 *                   score:
 *                     type: number
 *                     description: Derived deterministically by the backend (1 / 0.5 / 0) - never output by the LLM.
 *                   feedback:
 *                     type: string
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
 *     TopicGain:
 *       type: object
 *       description: Evidence-derived before/after comparison for one topic (zero ML).
 *       properties:
 *         topicId:
 *           type: string
 *         title:
 *           type: string
 *         reassessmentsCount:
 *           type: integer
 *         change:
 *           type: string
 *           enum: [improved, unchanged, declined, no_reassessment_yet]
 *         baselineMasteryLevel:
 *           type: string
 *           enum: [no_evidence, beginner, intermediate, advanced, mastered]
 *         baselineAverageScore:
 *           type: number
 *         baselineEvidenceCount:
 *           type: integer
 *         currentMasteryLevel:
 *           type: string
 *           enum: [no_evidence, beginner, intermediate, advanced, mastered]
 *         currentAverageScore:
 *           type: number
 *         evidenceCount:
 *           type: integer
 *     LearningGainReport:
 *       type: object
 *       description: >-
 *         Deterministic learning-gain report: mastery (from structured
 *         evidence by fixed rules) before the first reassessment of each
 *         topic vs now. Computed on read, never stored.
 *       properties:
 *         courseId:
 *           type: string
 *         topics:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TopicGain'
 *         overview:
 *           type: object
 *           properties:
 *             reassessmentsCount:
 *               type: integer
 *             reassessedTopicsCount:
 *               type: integer
 *             improvedTopicsCount:
 *               type: integer
 *             unchangedTopicsCount:
 *               type: integer
 *             declinedTopicsCount:
 *               type: integer
 *             currentOverallAverageScore:
 *               type: number
 *         generatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /courses/{courseId}/reassessments:
 *   post:
 *     summary: Start a reassessment on a topic that already has evidence (student owner only)
 *     description: >-
 *       Requires existing learning evidence on the topic (400 otherwise - the
 *       diagnostic is the entry point). Snapshots the current deterministic
 *       mastery level as masteryLevelBefore and generates questions via the
 *       AI provider.
 *     tags: [Reassessment & Gain]
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
 *                 default: 2
 *     responses:
 *       201:
 *         description: Reassessment session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ReassessmentSession'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   get:
 *     summary: List the caller's reassessment sessions in a course (student owner only)
 *     tags: [Reassessment & Gain]
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
 *         description: Reassessment sessions (newest first)
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
 *                     $ref: '#/components/schemas/ReassessmentSession'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @openapi
 * /courses/{courseId}/reassessments/{reassessmentId}:
 *   get:
 *     summary: Get one reassessment session with questions and answers (owner only)
 *     tags: [Reassessment & Gain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: reassessmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The reassessment session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ReassessmentSession'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @openapi
 * /courses/{courseId}/reassessments/{reassessmentId}/answers:
 *   post:
 *     summary: Answer a reassessment question - AI evaluates and writes learning evidence (owner only)
 *     description: >-
 *       The AI classifies the answer only; the score is derived
 *       deterministically and a structured learning_evidence row
 *       (sourceType "reassessment") is written immediately, moving the
 *       deterministic learner model. Completing all questions auto-completes
 *       the session.
 *     tags: [Reassessment & Gain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: reassessmentId
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
 *         description: Evaluation result and the created evidence id
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
 *                       $ref: '#/components/schemas/ReassessmentSession'
 *                     answer:
 *                       type: object
 *                       properties:
 *                         questionId:
 *                           type: string
 *                         evaluation:
 *                           type: object
 *                           properties:
 *                             correctness:
 *                               type: string
 *                             score:
 *                               type: number
 *                             feedback:
 *                               type: string
 *                         evidenceId:
 *                           type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @openapi
 * /courses/{courseId}/learning-gain:
 *   get:
 *     summary: Get the deterministic learning-gain report (student owner only)
 *     description: >-
 *       Per topic: mastery derived from evidence BEFORE the first reassessment
 *       (the baseline) vs mastery derived from all evidence now. Without a
 *       reassessment the change is reported as no_reassessment_yet instead of
 *       faking a baseline. Zero ML, computed on read, never stored.
 *     tags: [Reassessment & Gain]
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
 *         description: The learning-gain report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/LearningGainReport'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */