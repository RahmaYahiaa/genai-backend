import { MATERIAL_SOURCE_TYPES, MATERIAL_STATUSES } from '../../config/constants.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
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
  chunkOptions,
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
    await requireMaterialInCourse(course, materialId);

    await materialChunkRepository.deleteByMaterialId(materialId);
    await materialRepository.deleteById(materialId);
    return { deleted: true };
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
    listMaterials,
    getMaterial,
    deleteMaterial,
    listChunks,
  };
}