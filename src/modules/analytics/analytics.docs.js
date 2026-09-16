/**
 * @openapi
 * /courses/{courseId}/analytics:
 *   get:
 *     summary: Precomputed course analytics (instructor)
 *     description: >-
 *       Instructor/admin of the course only. Reads the PRECOMPUTED snapshot -
 *       never aggregates on request. The snapshot is refreshed by a debounced
 *       in-process recompute triggered by domain events (SubmissionFinalized,
 *       LearningEvidenceCreated, MaterialsUploaded, AssignmentClosed), so a
 *       bulk approval of 200 submissions collapses into ONE recompute. The
 *       payload carries course totals (finalized/pending-review/fast-track
 *       counters, average course percentage 0-100, assignment and material
 *       counts) and per-topic stats: evidence count, distinct students,
 *       average score percentage, and the evidence ids every number is
 *       traceable to. A missing snapshot returns an empty skeleton and
 *       schedules a recompute.
 *     tags: [Instructor Analytics]
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
 *         description: Analytics snapshot (or an empty skeleton before the first recompute)
 *       403:
 *         description: Not an instructor/admin of the course
 */

/**
 * @openapi
 * /courses/{courseId}/coverage-gaps:
 *   get:
 *     summary: Topics with no assignment-question coverage (instructor)
 *     description: >-
 *       Instructor/admin only, from the same precomputed snapshot. A topic is
 *       a coverage gap when no question of any non-draft assignment targets
 *       it. Returns the gap topics plus totalTopics/coveredTopics counters so
 *       the instructor sees the overall assessment coverage at a glance.
 *     tags: [Instructor Analytics]
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
 *         description: Coverage gaps with counters
 *       403:
 *         description: Not an instructor/admin of the course
 */

/**
 * @openapi
 * /instructor/home:
 *   get:
 *     summary: Instructor home dashboard feed
 *     description: >-
 *       Instructors/admins only (students 403). One row per course the caller
 *       staffs, from the precomputed snapshots: pending-review count,
 *       fast-track count, finalized count and the snapshot timestamp, sorted
 *       by pending-review DESC (most urgent first). READ-ONLY by design -
 *       the home feed never embeds approve/decision actions; decisions live
 *       in the assignment review endpoints.
 *     tags: [Instructor Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Per-course counters sorted by pending review
 *       403:
 *         description: Students cannot access the instructor home
 */