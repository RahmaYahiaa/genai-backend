import path from 'node:path';
import { MATERIAL_SOURCE_TYPES, MATERIAL_STATUSES } from '../../config/constants.js';
import { NotFoundError, UnprocessableEntityError, ValidationError } from '../../shared/errors/index.js';
import { toPublicMaterial } from './material.model.js';
import { toPublicChunk } from './material-chunk.model.js';
import { chunkText } from '../../shared/text/chunker.js';

/**
 * Knowledge ingestion: turns uploaded course text into chunked, embedded,
 * tenant-scoped trusted sources.
 *
 * Upload policy (product decision): institutional material is managed by the
 * institution admin and course staff only - institutional students consume it.
 * Personal learning spaces are fully managed by their owner.
 *
 * Generated/provider internals never leak: failures are recorded as a
 * generic statusError on the material.
 */
export function createKnowledgeIngestionService({
  coursesService,
  materialRepository,
  materialChunkRepository,
  embeddingProvider,
  textExtractor,
  fileTextExtractor,
  fileStorage,
  chunkOptions,
  domainEvents,
}) {
  /**
   * Normalized course identifier: coursesService.getCourse returns the public
   * shape (`id`) while ensureCourseWriteAccess returns the lean document
   * (`_id`); every scope check below works with a string id either way.
   */
  function courseDocumentId(course) {
    return course.id ?? String(course._id);
  }

  async function requireMaterialInCourse(course, materialId) {
    const material = await materialRepository.findById(materialId);
    if (!material || String(material.courseId) !== String(courseDocumentId(course))) {
      throw new NotFoundError('Material not found');
    }
    return material;
  }

  async function uploadMaterial(user, courseId, data) {
    // Write access = institution admin/course staff, or personal owner.
    const course = await coursesService.ensureCourseWriteAccess(user, courseId);

    // Extraction may reject unsupported types before anything is persisted.
    const rawText = textExtractor.extract({
      fileName: data.fileName,
      mimeType: data.mimeType,
      content: data.content,
    });

    const chunkTexts = chunkText(rawText, chunkOptions);
    if (chunkTexts.length === 0) {
      throw new ValidationError('Material has no extractable text content');
    }

    const material = await materialRepository.create({
      courseId: courseDocumentId(course),
      institutionId: course.institutionId ?? null,
      isPersonal: Boolean(course.isPersonal),
      uploadedBy: user.id,
      topicId: data.topicId ?? null,
      title: data.title,
      sourceType:
        data.sourceType ??
        (course.isPersonal ? MATERIAL_SOURCE_TYPES.TEXTBOOK : MATERIAL_SOURCE_TYPES.LECTURE_NOTES),
      mimeType: data.mimeType ?? 'text/plain',
      status: MATERIAL_STATUSES.PROCESSING,
      extractionProvider: textExtractor.name,
      sizeChars: rawText.length,
    });

    try {
      const vectors = await embeddingProvider.embed(chunkTexts);

      await materialChunkRepository.insertManyChunks(
        chunkTexts.map((text, index) => ({
          materialId: material._id,
          courseId: courseDocumentId(course),
          institutionId: course.institutionId ?? null,
          order: index,
          text,
          charCount: text.length,
          embedding: vectors[index],
          embeddingModel: embeddingProvider.model,
          embeddingDim: embeddingProvider.dimensions,
        })),
      );

      const ready = await materialRepository.updateById(material._id, {
        $set: {
          status: MATERIAL_STATUSES.READY,
          chunkCount: chunkTexts.length,
          embeddingModel: embeddingProvider.model,
        },
      });
      domainEvents.emit('MaterialsUploaded', {
        courseId: courseDocumentId(course).toString(),
        materialId: material._id.toString(),
      });
      return toPublicMaterial(ready);
    } catch (error) {
      // Mark the material failed without exposing provider internals.
      await materialRepository.updateById(material._id, {
        $set: { status: MATERIAL_STATUSES.FAILED, statusError: 'Material processing failed' },
      });
      throw error;
    }
  }

  async function listMaterials(user, courseId, { page, limit }) {
    const course = await coursesService.getCourse(user, courseId);
    const skip = (page - 1) * limit;
    const { items, total } = await materialRepository.listByCourse(courseDocumentId(course), {
      skip,
      limit,
    });
    return { items: items.map(toPublicMaterial), total };
  }

  async function getMaterial(user, courseId, materialId) {
    const course = await coursesService.getCourse(user, courseId);
    const material = await requireMaterialInCourse(course, materialId);
    return toPublicMaterial(material);
  }

  async function deleteMaterial(user, courseId, materialId) {
    const course = await coursesService.ensureCourseWriteAccess(user, courseId);
    const material = await requireMaterialInCourse(course, materialId);

    await materialChunkRepository.deleteByMaterialId(materialId);
    await materialRepository.deleteById(materialId);
    if (material.storageKey) {
      await fileStorage.deleteMaterialFile(material.storageKey);
    }
    return { deleted: true };
  }

  function resolveUploadTitle(desiredTitle, originalName) {
    const base = typeof desiredTitle === 'string' ? desiredTitle.trim() : '';
    if (base.length >= 2) return base.slice(0, 200);
    const withoutExtension = originalName.replace(/\.[A-Za-z0-9]{1,12}$/, '').trim();
    const candidate = withoutExtension.length >= 2 ? withoutExtension : originalName.trim();
    return (candidate.slice(0, 200) || 'Uploaded material');
  }

  function defaultSourceType(course) {
    return course.isPersonal
      ? MATERIAL_SOURCE_TYPES.TEXTBOOK
      : MATERIAL_SOURCE_TYPES.LECTURE_NOTES;
  }

  /**
   * Multipart file upload (same access rules as the inline text upload):
   * examinable files (text/markdown/pdf) are chunked+embedded into the RAG
   * knowledge base; any other extension is stored as-is and downloadable
   * without indexing. A text-expecting file with no readable text (scanned
   * PDF) is rejected before anything is persisted.
   */
  async function uploadMaterialFile(user, courseId, { file, title, sourceType, topicId }) {
    const course = await coursesService.ensureCourseWriteAccess(user, courseId);
    const originalName = path.basename(file.originalname || 'material').slice(0, 255);

    const rawText = await fileTextExtractor.extractFromFile({
      fileName: originalName,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });

    const materialFields = {
      courseId: courseDocumentId(course),
      institutionId: course.institutionId ?? null,
      isPersonal: Boolean(course.isPersonal),
      uploadedBy: user.id,
      topicId: topicId ?? null,
      title: resolveUploadTitle(title, originalName),
      sourceType: sourceType ?? defaultSourceType(course),
      mimeType: file.mimetype || 'application/octet-stream',
      storageKey: null,
      originalName,
      sizeBytes: 0,
      extractionProvider: fileTextExtractor.name,
    };

    if (rawText === null) {
      const stored = await fileStorage.saveMaterialFile(
        courseDocumentId(course),
        originalName,
        file.buffer,
      );
      materialFields.storageKey = stored.key;
      materialFields.sizeBytes = stored.sizeBytes;
      const material = await materialRepository.create({
        ...materialFields,
        status: MATERIAL_STATUSES.STORED_ONLY,
        sizeChars: 0,
      });
      domainEvents.emit('MaterialsUploaded', {
        courseId: materialFields.courseId.toString(),
        materialId: material._id.toString(),
      });
      return toPublicMaterial(material);
    }

    const chunkTexts = chunkText(rawText, chunkOptions);
    if (chunkTexts.length === 0) {
      throw new ValidationError('Material has no extractable text content');
    }

    const stored = await fileStorage.saveMaterialFile(
      courseDocumentId(course),
      originalName,
      file.buffer,
    );
    materialFields.storageKey = stored.key;
    materialFields.sizeBytes = stored.sizeBytes;

    const material = await materialRepository.create({
      ...materialFields,
      status: MATERIAL_STATUSES.PROCESSING,
      sizeChars: rawText.length,
    });

    try {
      const vectors = await embeddingProvider.embed(chunkTexts);

      await materialChunkRepository.insertManyChunks(
        chunkTexts.map((text, index) => ({
          materialId: material._id,
          courseId: courseDocumentId(course),
          institutionId: course.institutionId ?? null,
          order: index,
          text,
          charCount: text.length,
          embedding: vectors[index],
          embeddingModel: embeddingProvider.model,
          embeddingDim: embeddingProvider.dimensions,
        })),
      );

      const ready = await materialRepository.updateById(material._id, {
        $set: {
          status: MATERIAL_STATUSES.READY,
          chunkCount: chunkTexts.length,
          embeddingModel: embeddingProvider.model,
        },
      });
      domainEvents.emit('MaterialsUploaded', {
        courseId: materialFields.courseId.toString(),
        materialId: material._id.toString(),
      });
      return toPublicMaterial(ready);
    } catch (error) {
      await materialRepository.updateById(material._id, {
        $set: { status: MATERIAL_STATUSES.FAILED, statusError: 'Material processing failed' },
      });
      throw error;
    }
  }

  async function renameMaterial(user, courseId, materialId, { title }) {
    const course = await coursesService.ensureCourseWriteAccess(user, courseId);
    const material = await requireMaterialInCourse(course, materialId);
    const updated = await materialRepository.updateById(material._id, {
      $set: { title: title.trim() },
    });
    return toPublicMaterial(updated);
  }

  async function getMaterialFile(user, courseId, materialId) {
    const course = await coursesService.getCourse(user, courseId);
    const material = await requireMaterialInCourse(course, materialId);
    if (!material.storageKey) {
      throw new UnprocessableEntityError('This material has no stored file to download');
    }
    const absolutePath = await fileStorage.requireMaterialFile(material.storageKey);
    return { material: toPublicMaterial(material), absolutePath };
  }

  async function listChunks(user, courseId, materialId, { page, limit }) {
    const course = await coursesService.getCourse(user, courseId);
    await requireMaterialInCourse(course, materialId);

    const skip = (page - 1) * limit;
    const { items, total } = await materialChunkRepository.listByMaterial(materialId, {
      skip,
      limit,
    });
    return { items: items.map(toPublicChunk), total };
  }

  return {
    uploadMaterial,
    uploadMaterialFile,
    listMaterials,
    getMaterial,
    getMaterialFile,
    renameMaterial,
    deleteMaterial,
    listChunks,
  };
}