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
 *         originalName:
 *           type: string
 *           nullable: true
 *         sizeBytes:
 *           type: integer
 *         hasFile:
 *           type: boolean
 *           description: True when an original binary file is stored and downloadable.
 *         status:
 *           type: string
 *           enum: [pending, processing, ready, failed, stored_only]
 *           description: |
 *             stored_only = the original file is kept and downloadable but its
 *             type is not RAG-examinable (archives, media, office...), so it
 *             has no chunks and never appears in retrieval.
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

/**
 * @openapi
 * /courses/{courseId}/materials/file:
 *   post:
 *     summary: Upload a material file (multipart, 25MB max)
 *     description: >-
 *       Same access rules as the text upload (institution admin/course staff
 *       for institutional courses, personal owner for personal spaces).
 *       Accepts any file up to 25MB and stores the original for download.
 *       Examinable types (text/plain, text/markdown, pdf) are additionally
 *       chunked and embedded into the RAG knowledge base (status ready);
 *       any other extension is stored as-is (status stored_only) and never
 *       enters retrieval. A text-expecting file with no readable text (e.g.
 *       a scanned PDF) is rejected with 422 before anything is persisted.
 *       The optional title field defaults to the original file name without
 *       its extension.
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The material file (25MB max, any extension)
 *               title:
 *                 type: string
 *                 description: Optional display title (defaults to the file name)
 *               sourceType:
 *                 type: string
 *                 enum: [official_slides, lecture_notes, textbook, instructor_notes, external_reference]
 *     responses:
 *       201:
 *         description: File stored (status ready when indexed, stored_only otherwise)
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
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         description: File exceeds 25MB, unreadable, or has no extractable text (scanned PDF)
 */

/**
 * @openapi
 * /courses/{courseId}/materials/{materialId}/file:
 *   get:
 *     summary: Download the original material file (course read access)
 *     description: >-
 *       Streams the stored original file. Read access mirrors course reads -
 *       enrolled institutional students can download instructor material
 *       (read-only consumption), personal spaces only for their owner.
 *       Returns 422 for inline-text materials uploaded without a file.
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
 *         description: The original file (Content-Disposition attachment)
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         description: The material has no stored file
 */

/**
 * @openapi
 * /courses/{courseId}/materials/{materialId}:
 *   patch:
 *     summary: Rename a material (institution admin/course staff, personal owner)
 *     description: >-
 *       Write access only. Renames the display title; the stored file and its
 *       chunks are untouched.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 200
 *     responses:
 *       200:
 *         description: Renamed material
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
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */