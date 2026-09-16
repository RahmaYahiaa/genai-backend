import { mkdirSync, existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from '../../config/index.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';

const STORAGE_KEY_PATTERN = /^[0-9a-f]{24}\/[0-9a-f-]{36}(\.[a-z0-9]{1,12})?$/;

export function createFileStorage() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

  function storageRoot() {
    const configured = config.uploads.dir;
    return path.isAbsolute(configured) ? configured : path.resolve(repoRoot, configured);
  }

  function sanitizeExtension(originalName) {
    const match = /\.([A-Za-z0-9]{1,12})$/.exec(originalName ?? '');
    return match ? `.${match[1].toLowerCase()}` : '';
  }

  function resolvePath(key) {
    if (!STORAGE_KEY_PATTERN.test(key ?? '')) {
      throw new ValidationError('Invalid material file reference');
    }
    return path.join(storageRoot(), key);
  }

  async function saveMaterialFile(courseId, originalName, buffer) {
    const key = `${courseId}/${randomUUID()}${sanitizeExtension(originalName)}`;
    const absolutePath = path.join(storageRoot(), key);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer);
    return { key, sizeBytes: buffer.length };
  }

  async function requireMaterialFile(key) {
    const absolutePath = resolvePath(key);
    if (!existsSync(absolutePath)) {
      throw new NotFoundError('Material file is missing from storage');
    }
    return absolutePath;
  }

  async function deleteMaterialFile(key) {
    try {
      await fs.unlink(resolvePath(key));
    } catch {
      // The stored file may already be gone (re-seed, manual cleanup);
      // deletion of the database record must not fail because of that.
    }
  }

  return { saveMaterialFile, requireMaterialFile, deleteMaterialFile };
}