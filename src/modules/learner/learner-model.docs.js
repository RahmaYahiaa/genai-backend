/**
 * OpenAPI documentation for the deterministic learner model
 * (mastery levels, gap ranking, misconception aggregation, recommended next
 * action). Docs are kept separate from routing logic.
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     TopicMastery:
 *       type: object
 *       properties:
 *         topicId:
 *           type: string
 *         title:
 *           type: string
 *         masteryLevel:
 *           type: string
 *           enum: [no_evidence, beginner, intermediate, advanced, mastered]
 *           description: Derived by deterministic backend rules over learning evidence - never by an LLM.
 *         evidenceCount:
 *           type: integer
 *         averageScore:
 *           type: number
 *         lastEvidenceAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *     LearningGap:
 *       type: object
 *       description: Ranked weakness. Every gap carries the evidence ids that prove it.
 *       properties:
 *         topicId:
 *           type: string
 *         title:
 *           type: string
 *         masteryLevel:
 *           type: string
 *           enum: [no_evidence, beginner, intermediate]
 *         evidenceCount:
 *           type: integer
 *         averageScore:
 *           type: number
 *         severity:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           description: Escalated one step when the topic unlocks other topics (prerequisite of).
 *         dependentTopicIds:
 *           type: array
 *           items:
 *             type: string
 *         evidenceIds:
 *           type: array
 *           items:
 *             type: string
 *     MisconceptionAggregate:
 *       type: object
 *       properties:
 *         code:
 *           type: string
 *         occurrences:
 *           type: integer
 *         topicIds:
 *           type: array
 *           items:
 *             type: string
 *         status:
 *           type: string
 *           enum: [suspected, confirmed, resolved]
 *     LearnerModelSnapshot:
 *       type: object
 *       description: >-
 *         Computed on read from structured learning evidence by deterministic
 *         rules (zero ML). Never stored, so it can never drift from evidence.
 *       properties:
 *         courseId:
 *           type: string
 *         mastery:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TopicMastery'
 *         gaps:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/LearningGap'
 *         misconceptions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/MisconceptionAggregate'
 *         overview:
 *           type: object
 *           properties:
 *             topicsCount:
 *               type: integer
 *             assessedTopicsCount:
 *               type: integer
 *             masteredTopicsCount:
 *               type: integer
 *             gapsCount:
 *               type: integer
 *             evidenceCount:
 *               type: integer
 *             overallAverageScore:
 *               type: number
 *         recommendedNextAction:
 *           type: object
 *           description: Deterministic priority rules (continue/start diagnostic, review/practice topic, reassess).
 *           properties:
 *             action:
 *               type: string
 *               enum: [continue_diagnostic, start_diagnostic, review_topic, practice_topic, reassess, unavailable]
 *             topicId:
 *               type: string
 *               nullable: true
 *             diagnosticId:
 *               type: string
 *               nullable: true
 *             remainingQuestions:
 *               type: integer
 *               nullable: true
 *             reason:
 *               type: string
 *         generatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * components:
 *   tags:
 *     - name: Learner Model
 *       description: Per-student mastery profile and learning gaps
 */

/**
 * @openapi
 * /courses/{courseId}/learner-model:
 *   get:
 *     summary: Get the deterministic learner model (student owner only)
 *     description: >-
 *       Mastery per topic, ranked learning gaps (with evidence traceability),
 *       aggregated misconception codes, an overview, and the recommended next
 *       action. Pure deterministic rules over learning_evidence - the LLM is
 *       never involved. Computed on read, owner-only access.
 *     tags: [Learner Model]
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
 *         description: The learner model snapshot
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/LearnerModelSnapshot'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */