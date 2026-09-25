import PptxGenJS from 'pptxgenjs';

/**
 * Real PPTX deck builder (EDUNation parity). Input is a VALIDATED outline
 * { title, subtitle?, slides: [{ title, bullets: [] }] }; theme and layout
 * are fixed here so the model only contributes structured content.
 */
export async function buildPresentationBuffer(outline) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDE';
  pptx.title = outline.title ?? 'Study deck';

  const TITLE = '#0A2540';
  const ACCENT = '#136FA3';
  const BODY = '#26415A';
  const FONT = 'Segoe UI';

  // Cover slide.
  const cover = pptx.addSlide();
  cover.background = { color: '#F5FBFF' };
  cover.addText(String(outline.title ?? ''), {
    x: 0.8, y: 2.6, w: 11.7, h: 1.3,
    fontFace: FONT, fontSize: 34, bold: true, color: TITLE, align: 'center',
  });
  if (outline.subtitle) {
    cover.addText(String(outline.subtitle), {
      x: 0.8, y: 4.0, w: 11.7, h: 0.7,
      fontFace: FONT, fontSize: 16, color: BODY, align: 'center',
    });
  }
  cover.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.18, fill: { color: ACCENT } });

  for (const slide of (outline.slides ?? []).slice(0, 12)) {
    const s = pptx.addSlide();
    s.addText(String(slide.title ?? ''), {
      x: 0.6, y: 0.35, w: 12.1, h: 0.8,
      fontFace: FONT, fontSize: 24, bold: true, color: ACCENT,
    });
    s.addShape('line', { x: 0.6, y: 1.2, w: 12.1, h: 0, line: { color: ACCENT, width: 1.5 } });
    const bullets = (slide.bullets ?? []).slice(0, 8).map((bullet) => ({
      text: String(bullet),
      options: { bullet: { code: '25AA' }, color: BODY, fontSize: 15, paraSpaceAfter: 8 },
    }));
    s.addText(bullets.length > 0 ? bullets : [{ text: '' }], {
      x: 0.8, y: 1.5, w: 11.8, h: 5.4,
      fontFace: FONT, color: BODY, fontSize: 15, valign: 'top',
    });
  }

  return Buffer.from(await pptx.write({ outputType: 'nodebuffer' }));
}

/** Deterministic fallback outline when no LLM outline is available. */
export function fallbackOutline(topic, language) {
  const ar = language === 'ar';
  return {
    title: topic,
    subtitle: ar ? 'ملخص دراسي مولّد' : 'Generated study deck',
    slides: [
      { title: ar ? 'نظرة عامة' : 'Overview', bullets: [topic, ar ? 'أهم الأفكار والمفاهيم المرتبطة' : 'Key ideas and related concepts'] },
      { title: ar ? 'المفاهيم الأساسية' : 'Core concepts', bullets: [ar ? 'التعريف والخصائص' : 'Definition and properties', ar ? 'المكوّنات والخطوات' : 'Components and steps'] },
      { title: ar ? 'مثال تطبيقي' : 'Worked example', bullets: [ar ? 'تطبيق قصير خطوة بخطوة' : 'Short step-by-step application'] },
      { title: ar ? 'نقاط للمراجعة' : 'Review points', bullets: [ar ? 'أكثر النقاط أهمية قبل الاختبار' : 'Most important points before the exam'] },
    ],
  };
}
