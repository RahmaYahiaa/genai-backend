import multer from 'multer';
import { UnprocessableEntityError, ValidationError } from '../../shared/errors/index.js';

export const MATERIAL_FILE_MAX_BYTES = 25 * 1024 * 1024;

export function createMaterialUploadMiddleware() {
  const uploader = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MATERIAL_FILE_MAX_BYTES, files: 1 },
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
      next();
    });
  };
}