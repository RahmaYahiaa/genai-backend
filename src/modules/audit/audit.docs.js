/**
 * @openapi
 * /courses/{courseId}/audit-log:
 *   get:
 *     summary: Filtered course audit trail (governance read model)
 *     description: >-
 *       Instructor/admin of the course only - students always get 403. Every
 *       row is one recorded governance action (APPROVE, EDIT, REJECT,
 *       REQUEST_RESUBMISSION, TOGGLE_GRADE_VISIBILITY) and ALWAYS carries
 *       aiOriginalScore next to finalScore, so the platform keeps a permanent
 *       record of what the AI suggested versus what the instructor finalized.
 *       Also includes the resubmission reasonText when present, the actor's
 *       display name, and server-side pagination with filters: action,
 *       assignmentId, from/to (ISO dates).
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [APPROVE, EDIT, REJECT, REQUEST_RESUBMISSION, TOGGLE_GRADE_VISIBILITY]
 *       - in: query
 *         name: assignmentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
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
 *         description: Paginated audit rows (newest first)
 *       403:
 *         description: Not an instructor/admin of the course (students always 403)
 */