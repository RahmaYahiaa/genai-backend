/**
 * Deterministic SVG flow-diagram renderer (EDUNation parity). The LLM (or a
 * deterministic fallback) only produces a VALIDATED spec: {title, steps[]}.
 * All geometry, escaping, wrapping and theming happen here so a model can
 * never inject markup or break the artifact. Text is XML-escaped by
 * construction; no model output is ever embedded raw.
 */

const PALETTE = {
  bg: '#F5FBFF',
  border: '#136FA3',
  boxFill: '#FFFFFF',
  boxStroke: '#136FA3',
  title: '#0A2540',
  text: '#26415A',
  accent: '#0E5B88',
  arrow: '#61778C',
};

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapText(text, maxChars) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * spec = { title, steps: [{ label, detail? }] } — 2..8 steps, rendered as a
 * left-to-right flow with rounded cards and connecting arrows.
 */
export function renderFlowDiagram(spec) {
  const steps = (spec.steps ?? []).slice(0, 8);
  const boxW = 190;
  const boxHPad = 22;
  const lineH = 15;
  const gapX = 46;
  const marginX = 28;
  const titleH = 46;
  const boxMaxLines = 5;

  const boxes = steps.map((step) => {
    const labelLines = wrapText(step.label, 26).slice(0, 2);
    const detailLines = step.detail ? wrapText(step.detail, 30).slice(0, 3) : [];
    const contentLines = labelLines.length + detailLines.length;
    const height = Math.min(boxHPad * 2 + contentLines * lineH, boxHPad * 2 + boxMaxLines * lineH);
    return { step, labelLines, detailLines, height };
  });

  const maxHeight = Math.max(...boxes.map((box) => box.height), 90);
  const width = marginX * 2 + boxes.length * boxW + (boxes.length - 1) * gapX;
  const height = titleH + maxHeight + 60;

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Segoe UI, Tahoma, Arial, sans-serif">`,
  );
  parts.push(`<rect width="${width}" height="${height}" fill="${PALETTE.bg}" rx="14"/>`);
  const titleLines = wrapText(spec.title ?? '', 72).slice(0, 1);
  parts.push(
    `<text x="${width / 2}" y="34" text-anchor="middle" font-size="17" font-weight="700" fill="${PALETTE.title}">${esc(titleLines[0] ?? '')}</text>`,
  );

  boxes.forEach((box, index) => {
    const x = marginX + index * (boxW + gapX);
    const y = titleH + (maxHeight - box.height);
    if (index > 0) {
      const prevRight = marginX + (index - 1) * (boxW + gapX) + boxW;
      const midY = titleH + maxHeight / 2;
      parts.push(
        `<line x1="${prevRight + 4}" y1="${midY}" x2="${x - 8}" y2="${midY}" stroke="${PALETTE.arrow}" stroke-width="1.6"/>`,
        `<polygon points="${x - 8},${midY - 4.5} ${x - 8},${midY + 4.5} ${x - 1.5},${midY}" fill="${PALETTE.arrow}"/>`,
      );
    }
    parts.push(
      `<rect x="${x}" y="${y}" width="${boxW}" height="${box.height}" rx="12" fill="${PALETTE.boxFill}" stroke="${PALETTE.boxStroke}" stroke-width="1.4"/>`,
    );
    parts.push(
      `<rect x="${x}" y="${y}" width="${boxW}" height="4.5" rx="2.2" fill="${PALETTE.accent}"/>`,
    );
    let cursorY = y + boxHPad;
    for (const line of box.labelLines) {
      parts.push(
        `<text x="${x + boxW / 2}" y="${cursorY}" text-anchor="middle" font-size="12.5" font-weight="700" fill="${PALETTE.title}">${esc(line)}</text>`,
      );
      cursorY += lineH;
    }
    for (const line of box.detailLines) {
      parts.push(
        `<text x="${x + boxW / 2}" y="${cursorY}" text-anchor="middle" font-size="10.5" fill="${PALETTE.text}">${esc(line)}</text>`,
      );
      cursorY += lineH;
    }
  });

  parts.push('</svg>');
  return parts.join('\n');
}

/** Deterministic fallback spec when no LLM spec is available. */
export function fallbackDiagramSpec(topic, language) {
  const ar = language === 'ar';
  return {
    title: topic,
    steps: [
      { label: ar ? 'المفهوم الأساسي' : 'Core idea', detail: topic },
      { label: ar ? 'كيف يعمل' : 'How it works', detail: ar ? 'الخطوات أو المكوّنات الرئيسية' : 'Key steps or components' },
      { label: ar ? 'مثال تطبيقي' : 'Worked example', detail: ar ? 'تطبيق قصير على المفهوم' : 'Short application of the concept' },
      { label: ar ? 'تدرّب' : 'Practice', detail: ar ? 'سؤال أو تمرين للتحقق' : 'A question or exercise to verify' },
      { label: ar ? 'مراجعة وتثبيت' : 'Review & recall', detail: ar ? 'أهم النقاط للمراجعة' : 'Key points to revisit' },
    ],
  };
}
