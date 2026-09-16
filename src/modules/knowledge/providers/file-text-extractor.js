import { PDFParse } from 'pdf-parse';
import { UnprocessableEntityError } from '../../../shared/errors/index.js';

const PDF_PAGE_FOOTER_PATTERN = /\s*--\s*\d+\s+of\s+\d+\s*--\s*/g;

function examinedKind(fileName, mimeType) {
  const extension = /\.([a-z0-9]+)$/i.exec(fileName ?? '')?.[1]?.toLowerCase() ?? '';
  if (extension === 'pdf' || mimeType === 'application/pdf') return 'pdf';
  if (['txt', 'text', 'md', 'markdown'].includes(extension)) return 'text';
  if (typeof mimeType === 'string' && mimeType.startsWith('text/')) return 'text';
  return null;
}

export function createFileTextExtractor({ provider = 'file-v1' } = {}) {
  if (provider !== 'file-v1') {
    throw new Error(`Unknown file text extractor "${provider}"`);
  }

  return {
    name: 'file-v1',

    /**
     * Returns the raw text of examinable files (text/markdown/pdf) or null
     * when the file type is stored-as-is only (archives, media, office...).
     * Throws ValidationError when a text-expecting file carries no readable
     * text (e.g. scanned PDFs) so it never enters the RAG knowledge base.
     */
    async extractFromFile({ fileName = '', mimeType, buffer }) {
      const kind = examinedKind(fileName, mimeType);
      if (!kind) return null;

      if (kind === 'text') {
        const text = buffer.toString('utf8');
        if (text.trim().length === 0) {
          throw new UnprocessableEntityError('This file contains no readable text');
        }
        return text;
      }

      let text;
      try {
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        try {
          text = (await parser.getText()).text ?? '';
        } finally {
          await parser.destroy();
        }
      } catch {
        throw new UnprocessableEntityError('This file claims to be a PDF but could not be read');
      }

      const readable = text.replace(PDF_PAGE_FOOTER_PATTERN, ' ').trim();
      if (readable.length === 0) {
        throw new UnprocessableEntityError(
          'This PDF has no extractable text (scanned or image-only PDFs are not supported yet)',
        );
      }
      return readable;
    },
  };
}