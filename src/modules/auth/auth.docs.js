/**
 * @openapi
 * components:
 *   schemas:
 *     AuthUser:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 665f1c9e2a4b3c6d7e8f9a0b
 *         email:
 *           type: string
 *           format: email
 *           example: sara@student.edu.eg
 *         firstName:
 *           type: string
 *           example: Sara
 *         lastName:
 *           type: string
 *           example: Hassan
 *         role:
 *           type: string
 *           enum: [student, instructor, institution_admin]
 *         institutionId:
 *           type: string
 *           example: 665f1c9e2a4b3c6d7e8f9a0b
 *         languagePreference:
 *           type: string
 *           enum: [en, ar]
 *         isActive:
 *           type: boolean
 *         lastLoginAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *     AuthTokens:
 *       type: object
 *       required: [accessToken, refreshToken]
 *       properties:
 *         accessToken:
 *           type: string
 *           description: 'Short-lived JWT (default 15m). Send as "Authorization: Bearer <token>".'
 *         refreshToken:
 *           type: string
 *           description: Long-lived JWT (default 7d) used at /auth/refresh. Revoked on logout.
 *     AuthSession:
 *       type: object
 *       properties:
 *         user:
 *           $ref: '#/components/schemas/AuthUser'
 *         tokens:
 *           $ref: '#/components/schemas/AuthTokens'
 *     RegisterRequest:
 *       type: object
 *       required: [email, password, firstName, lastName, role]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 8
 *           description: At least 8 chars, with at least one letter and one number.
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         role:
 *           type: string
 *           enum: [student, instructor, institution_admin]
 *         institutionId:
 *           type: string
 *           description: Required for student/instructor. The tenant to join.
 *         institutionName:
 *           type: string
 *           description: Required for institution_admin only. Creates the new tenant (bootstrap).
 *         languagePreference:
 *           type: string
 *           enum: [en, ar]
 *           default: en
 *     LoginRequest:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *     RefreshRequest:
 *       type: object
 *       required: [refreshToken]
 *       properties:
 *         refreshToken:
 *           type: string
 *     UpdateProfileRequest:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         languagePreference:
 *           type: string
 *           enum: [en, ar]
 */

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     description:
 *       Students and instructors register into an existing institution (institutionId required).
 *       An institution admin registers with institutionName, which bootstraps the tenant.
 *       Returns the created user and an initial token pair.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered (and tenant created when institution_admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSession'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Authenticated; returns user and fresh token pair
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSession'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Rotate tokens using a refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshRequest'
 *     responses:
 *       200:
 *         description: New token pair issued (reuse after logout is rejected)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSession'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Logout (revokes all tokens for the user)
 *     description:
 *       Bumps the internal token version, instantly invalidating every previously
 *       issued access and refresh token for this user.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out; all existing tokens are now invalid
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get the authenticated user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AuthUser'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   patch:
 *     summary: Update own profile (names, language preference)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       200:
 *         description: Updated user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AuthUser'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
