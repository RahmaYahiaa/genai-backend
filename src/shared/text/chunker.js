/**
 * Deterministic text chunker for knowledge ingestion. Splits on paragraph
 * boundaries first, falls back to sentence/character splits for oversized
 * paragraphs, and prepends a small tail of the previous chunk as overlap so
 * ideas cut at a boundary stay retrievable from the neighboring chunk.
 */

export function chunkText(text, { maxChars, overlapChars }) {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .split('\u0000')
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2}/);
  const chunks = [];

  const pushChunk = (value) => {
    const trimmed = value.trim();
    if (trimmed) chunks.push(trimmed);
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      // Oversized paragraph: split on sentence boundaries when possible.
      let start = 0;
      while (start < paragraph.length) {
        let end = Math.min(start + maxChars, paragraph.length);
        if (end < paragraph.length) {
          const sentenceBreak = paragraph.lastIndexOf('. ', end);
          if (sentenceBreak > start + maxChars * 0.5) {
            end = sentenceBreak + 1;
          }
        }
        pushChunk(paragraph.slice(start, end));
        if (overlapChars > 0 && end < paragraph.length) {
          start = Math.max(start, end - overlapChars);
        } else {
          start = end;
        }
      }
      continue;
    }

    const last = chunks.length - 1;
    if (last >= 0 && chunks[last].length + 2 + paragraph.length <= maxChars) {
      chunks[last] += '\n\n' + paragraph;
    } else {
      pushChunk(paragraph);
    }
  }

  // Cross-chunk overlap for assembled chunks.
  if (overlapChars > 0 && chunks.length > 1) {
    const withOverlap = [chunks[0]];
    for (let i = 1; i < chunks.length; i += 1) {
      const tail = chunks[i - 1].slice(-overlapChars);
      withOverlap.push(tail ? `${tail}\n${chunks[i]}` : chunks[i]);
    }
    return withOverlap;
  }

  return chunks;
}