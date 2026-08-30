/**
 * Text extraction provider for knowledge ingestion.
 *
 * Stage A accepts plain text / markdown content handed over by the client
 * (typed text or the contents of a .txt/.md file). Binary formats (PDF,
 * Office, media) are rejected with a clear error today and become additional
 * extraction providers later (file parser / OCR behind this same interface),
 * without any change to the ingestion service.
 */

import { ValidationError } from '../../../shared/errors/index.js';

const SUPPORTED_MIME_TYPES = new Set(['text/plain', 'text/markdown']);

// Common binary formats that require a real extraction provider.
const KNOWN_BINARY_PATTERN = /\.(pdf|docx?|pptx?|xlsx?|zip|png|jpe?g|gif|mp3|mp4)$/i;

function guessMimeFromFileName(fileName) {
  if (/\.md$/i.test(fileName)) return 'text/markdown';
  if (/\.(txt|text)$/i.test(fileName)) return 'text/plain';
  return null;
}

export function createTextExtractor({ provider = 'plain' } = {}) {
  if (provider !== 'plain') {
    throw new Error(`Unknown text extractor "${provider}"`);
  }

  return {
    name: 'plain',

    /** Returns the raw text to chunk. Throws ValidationError for bad input. */
    extract({ fileName = '', mimeType, content }) {
      const resolvedMime = mimeType ?? guessMimeFromFileName(fileName);

      if (resolvedMime && !SUPPORTED_MIME_TYPES.has(resolvedMime)) {
        throw new ValidationError(
          'Unsupported material type; Stage A accepts text/plain and text/markdown only',
        );
      }
      if (KNOWN_BINARY_PATTERN.test(fileName)) {
        throw new ValidationError(
          'Binary formats (pdf, office, media) require the file-extraction provider; provide text content instead',
        );
      }

      return String(content ?? '');
    },
  };
}