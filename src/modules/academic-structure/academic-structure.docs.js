/**
 * OpenAPI documentation for the Academic Structure module
 * (institution profile + faculty/department/program/semester units).
 * Docs are kept separate from routing logic.
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     Institution:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *           example: Zagazig University
 *         country:
 *           type: string
 *           nullable: true
 *         defaultLanguage:
 *           type: string
 *           enum: [en, ar]
 *         emailDomains:
 *           type: array
 *           items:
 *             type: string
 *             example: zu.edu.eg
 *           description: Verified email domains for institutional self-registration.
 *         isActive:
 *           type: boolean
 *         settings:
 *           type: object
 *           properties:
 *             allowSelfRegistration:
 *               type: boolean
 *             allowedSupplementalSourceTypes:
 *               type: array
 *               items:
 *                 type: string
 *     AcademicUnitAncestor:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         type:
 *           type: string
 *           enum: [faculty, department, program, semester]
 *         name:
 *           type: string
 *     AcademicUnit:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         institutionId:
 *           type: string
 *         type:
 *           type: string
 *           enum: [faculty, department, program, semester]
 *         name:
 *           type: string
 *         code:
 *           type: string
 *           nullable: true
 *         parentId:
 *           type: string
 *           nullable: true
 *         ancestors:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AcademicUnitAncestor'
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CreateUnitRequest:
 *       type: object
 *       required: [type, name]
 *       properties:
 *         type:
 *           type: string
 *           enum: [faculty, department, program, semester]
 *         name:
 *           type: string
 *           example: Faculty of Engineering
 *         code:
 *           type: string
 *           example: ENG
 *         parentId:
 *           type: string
 *           description: Parent unit id. Must be of a higher level (faculty > department > program > semester).
 *     UpdateUnitRequest:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         name:
 *           type: string
 *         code:
 *           type: string
 *           nullable: true
 *         isActive:
 *           type: boolean
 *     UpdateInstitutionRequest:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         name:
 *           type: string
 *         country:
 *           type: string
 *         defaultLanguage:
 *           type: string
 *           enum: [en, ar]
 *         emailDomains:
 *           type: array
 *           items:
 *             type: string
 *         allowSelfRegistration:
 *           type: boolean
 *         isActive:
 *           type: boolean
 */

/**
 * @openapi
 * /institutions/me:
 *   get:
 *     summary: Get the caller institution (admin)
 *     tags: [Academic Structure]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The institution of the authenticated admin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Institution'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @openapi
 * /institutions/{institutionId}:
 *   patch:
 *     summary: Update institution profile and governance settings (admin, own institution only)
 *     description: Update name, country, default language, verified email domains, and self-registration policy.
 *     tags: [Academic Structure]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: institutionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateInstitutionRequest'
 *     responses:
 *       200:
 *         description: Updated institution
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Institution'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */

/**
 * @openapi
 * /institutions/{institutionId}/units:
 *   post:
 *     summary: Create an academic unit (admin, own institution only)
 *     description: Creates a faculty, department, program, or semester node. Nesting must follow faculty > department > program > semester.
 *     tags: [Academic Structure]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: institutionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUnitRequest'
 *     responses:
 *       201:
 *         description: Unit created (with materialized ancestors path)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AcademicUnit'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *   get:
 *     summary: List academic units (admin/instructor, own institution only)
 *     tags: [Academic Structure]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: institutionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [faculty, department, program, semester]
 *       - in: query
 *         name: parentId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Units list
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
 *                     $ref: '#/components/schemas/AcademicUnit'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @openapi
 * /units/{unitId}:
 *   patch:
 *     summary: Update an academic unit (admin, own institution only)
 *     tags: [Academic Structure]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUnitRequest'
 *     responses:
 *       200:
 *         description: Updated unit
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AcademicUnit'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Delete an academic unit (admin, own institution only)
 *     description: Rejected with 409 when the unit still has child units.
 *     tags: [Academic Structure]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */