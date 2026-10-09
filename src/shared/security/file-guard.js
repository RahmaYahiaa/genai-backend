/**
 * File guard: decides which uploaded files are allowed on the platform.
 *
 * Two checks, both required:
 *  1. The extension must be on the allow-list (no .exe, .bat, .js, .html, .svg ...).
 *  2. The real bytes must match that extension (a renamed .exe -> .pdf is refused).
 *
 * Executables and scripts are refused whatever name or type they claim.
 */

const ALLOWED = {
  pdf: { mime: 'application/pdf', kind: 'pdf' },
  txt: { mime: 'text/plain', kind: 'text' },
  text: { mime: 'text/plain', kind: 'text' },
  md: { mime: 'text/markdown', kind: 'text' },
  markdown: { mime: 'text/markdown', kind: 'text' },
  csv: { mime: 'text/csv', kind: 'text' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'office' },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'office' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'office' },
  png: { mime: 'image/png', kind: 'png' },
  jpg: { mime: 'image/jpeg', kind: 'jpeg' },
  jpeg: { mime: 'image/jpeg', kind: 'jpeg' },
  webp: { mime: 'image/webp', kind: 'webp' },
  mp4: { mime: 'video/mp4', kind: 'mp4' },
  webm: { mime: 'video/webm', kind: 'webm' },
  mp3: { mime: 'audio/mpeg', kind: 'mp3' },
  wav: { mime: 'audio/wav', kind: 'wav' },
};

export const MATERIAL_EXTENSIONS = Object.keys(ALLOWED);
export const PROOF_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg'];

const startsWith = (buf, bytes, offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

/** Executables and scripts, recognised from their first bytes. */
function looksExecutable(buf) {
  return (
    startsWith(buf, ascii('MZ')) || // Windows .exe / .dll
    startsWith(buf, [0x7f, 0x45, 0x4c, 0x46]) || // Linux ELF
    startsWith(buf, [0xcf, 0xfa, 0xed, 0xfe]) || // macOS Mach-O
    startsWith(buf, [0xfe, 0xed, 0xfa, 0xcf]) ||
    startsWith(buf, [0xca, 0xfe, 0xba, 0xbe]) || // Mach-O universal / Java class
    startsWith(buf, ascii('#!')) // shell scripts
  );
}

function isPlainText(buf) {
  const sample = buf.subarray(0, 8192);
  if (sample.includes(0)) return false; // binary data
  const head = sample.toString('utf8', 0, 512).trimStart().toLowerCase();
  // Refuse web pages / scripts disguised as text: they could run in a browser.
  return !/^(<!doctype|<html|<script|<svg|<\?xml|<\?php)/.test(head);
}

function matchesKind(kind, buf) {
  switch (kind) {
    case 'pdf':
      return startsWith(buf, ascii('%PDF-'));
    case 'text':
      return isPlainText(buf);
    case 'office':
      return startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) && buf.includes('[Content_Types].xml');
    case 'png':
      return startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'jpeg':
      return startsWith(buf, [0xff, 0xd8, 0xff]);
    case 'webp':
      return startsWith(buf, ascii('RIFF')) && startsWith(buf, ascii('WEBP'), 8);
    case 'mp4':
      return startsWith(buf, ascii('ftyp'), 4);
    case 'webm':
      return startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3]);
    case 'mp3':
      return startsWith(buf, ascii('ID3')) || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0);
    case 'wav':
      return startsWith(buf, ascii('RIFF')) && startsWith(buf, ascii('WAVE'), 8);
    default:
      return false;
  }
}

export function fileExtension(fileName) {
  return /\.([a-z0-9]{1,12})$/i.exec(String(fileName ?? ''))?.[1]?.toLowerCase() ?? '';
}

/**
 * Returns null when the file is safe, otherwise a short user-facing reason.
 * On success also returns the trusted MIME type (never the browser-claimed one).
 */
export function inspectFile({ fileName, buffer, allowed = MATERIAL_EXTENSIONS }) {
  const ext = fileExtension(fileName);
  if (!ext || !allowed.includes(ext) || !ALLOWED[ext]) {
    return { ok: false, reason: `This file type is not allowed. Allowed: ${allowed.join(', ')}` };
  }
  if (!buffer || buffer.length === 0) {
    return { ok: false, reason: 'The file is empty' };
  }
  if (looksExecutable(buffer)) {
    return { ok: false, reason: 'Programs and scripts cannot be uploaded' };
  }
  if (!matchesKind(ALLOWED[ext].kind, buffer)) {
    return { ok: false, reason: `The file content does not match a real .${ext} file` };
  }
  return { ok: true, mimeType: ALLOWED[ext].mime, extension: ext };
}

export function trustedMimeFor(fileName) {
  return ALLOWED[fileExtension(fileName)]?.mime ?? 'application/octet-stream';
}
