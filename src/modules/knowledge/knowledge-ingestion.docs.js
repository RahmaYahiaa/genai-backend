/**
 * OpenAPI documentation for the Knowledge Ingestion module (Stage A:
 * course material upload -> text chunks -> embeddings -> trusted sources).
 * Docs are kept separate from routing logic.
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     Material:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         courseId:
 *           type: string
 *         institutionId:
 *           type: string
 *           nullable: true
 *         isPersonal:
 *           type: boolean
 *         uploadedBy:
 *           type: string
 *         title:
 *           type: string
 *           example: Graph Traversal - Lecture 3
 *         sourceType:
 *           type: string
 *           enum: [official_slides, lecture_notes, textbook, instructor_notes, external_reference]
 *         mimeType:
 *           type: string
 *         sizeChars:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [pending, processing, ready, failed]
 *         statusError:
 *           type: string
 *           nullable: true
 *         chunkCount:
 *           type: integer
 *         extractionProvider:
 *           type: string
 *           nullable: true
 *         embeddingModel:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *     CreateMaterialRequest:
 *       type: object
 *       required: [title, content]
 *       properties:
 *         title:
 *           type: string
 *         sourceType:
 *           type: string
 *           enum: [official_slides, lecture_notes, textbook, instructor_notes, external_reference]
 *           description: >-
 *             Defaults to lecture_notes for institutional courses and textbook
 *             for personal learning spaces.
 *         mimeType:
 *           type: string
 *           enum: [text/plain, text/markdown]
 *         fileName:
 *           type: string
 *           description: >-
 *             Optional original file name; .pdf/.docx and other binary formats
 *             are rejected until the file-extraction provider is connected.
 *         content:
 *           type: string
 *           description: Inline text content (20 to 200000 characters).
 *     MaterialChunk:
 *       type: object
 *       description: >-
 *         Chunk of trusted course material. Embedding vectors are internal and
 *         never included in API responses.
 *       properties:
 *         id:
 *           type: string
 *         materialId:
 *           type: string
 *         courseId:
 *           type: string
 *         order:
 *           type: integer
 *         text:
 *           type: string
 *         charCount:
 *           type: integer
 *         embeddingModel:
 *           type: string
 *         embeddingDim:
 *           type: integer
 */

/**
 * @openapi
 * /courses/{courseId}/materials:
 *   post:
 *     summary: Upload text material into a course knowledge base
 *     description: >-
 *       Institutional courses - institution admin and course staff only.
 *       Personal learning spaces - the owner only. The text is chunked and
 *       embedded synchronously; the response carries the final status.
 *     tags: [Knowledge Ingestion]
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
 *             $ref: '#/components/schemas/CreateMaterialRequest'
 *     responses:
 *       201:
 *         description: Material ingested (status ready or failed)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Material'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       502:
 *         description: Embedding provider failure (material is marked failed)
 *   get:
 *     summary: List course materials (course read access)
 *     tags: [Knowledge Ingestion]
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
 *         description: Materials page
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
 *                     $ref: '#/components/schemas/Material'
 *                 meta:
 *                   type: object
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @openapi
 * /courses/{courseId}/materials/{materialId}:
 *   get:
 *     summary: Get a material (course read access)
 *     tags: [Knowledge Ingestion]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: materialId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The material
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Material'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Delete a material and its chunks (institution admin/course staff, personal owner)
 *     tags: [Knowledge Ingestion]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: materialId
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
 * /courses/{courseId}/materials/{materialId}/chunks:
 *   get:
 *     summary: List the stored chunks of a material (course read access)
 *     description: >-
 *       Chunk inspection for debugging and traceability. Embedding vectors are
 *       never returned.
 *     tags: [Knowledge Ingestion]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: materialId
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
 *         description: Chunks page
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
 *                     $ref: '#/components/schemas/MaterialChunk'
 *                 meta:
 *                   type: object
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */