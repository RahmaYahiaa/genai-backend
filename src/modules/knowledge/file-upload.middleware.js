import multer from 'multer';
import { UnprocessableEntityError, ValidationError } from '../../shared/errors/index.js';
import { inspectFile, fileExtension, MATERIAL_EXTENSIONS } from '../../shared/security/file-guard.js';

export const MATERIAL_FILE_MAX_BYTES = 25 * 1024 * 1024;

export function createMaterialUploadMiddleware() {
  const uploader = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MATERIAL_FILE_MAX_BYTES, files: 1, fields: 10, fieldSize: 64 * 1024 },
    // Refuse disallowed types before the bytes are even read into memory.
    fileFilter: (req, file, cb) => {
      if (!MATERIAL_EXTENSIONS.includes(fileExtension(file.originalname))) {
        cb(new ValidationError(`This file type is not allowed. Allowed: ${MATERIAL_EXTENSIONS.join(', ')}`));
        return;
      }
      cb(null, true);
    },
  });

  return (req, res, next) => {
    uploader.single('file')(req, res, (error) => {
      if (error) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          next(new UnprocessableEntityError('File exceeds the 25MB upload limit'));
          return;
        }
        next(new ValidationError(error.message || 'File upload failed'));
        return;
      }
      if (!req.file) {
        next(new ValidationError("A 'file' field is required (multipart/form-data)"));
        return;
      }
      const verdict = inspectFile({ fileName: req.file.originalname, buffer: req.file.buffer });
      if (!verdict.ok) {
        next(new UnprocessableEntityError(verdict.reason));
        return;
      }
      // Never trust the browser-claimed type; use the one we verified.
      req.file.mimetype = verdict.mimeType;
      next();
    });
  };
}