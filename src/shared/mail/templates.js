import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { sendMail } from './mailer.js';

/**
 * One visual template for every transactional email (same colors as the app).
 * Every email has: a small header (app + optional institution), a title,
 * short paragraphs, an optional button, an optional detail list, and a footer.
 * Arabic emails are rendered right-to-left.
 */

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function appLink(path = '/') {
  return `${config.mail.appUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export function pickLang(value) {
  return value === 'ar' ? 'ar' : 'en';
}

export function renderEmail({ lang = 'en', subject, title, paragraphs = [], button = null, details = [], foot = '', institution = null }) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const align = lang === 'ar' ? 'right' : 'left';
  const app = config.mail.appName;
  const header = institution ? `${esc(app)} <span style="color:#94A3B8;font-weight:500">·</span> <span style="color:#334155;font-weight:600">${esc(institution)}</span>` : esc(app);
  const paras = paragraphs.map((p) => `<tr><td style="padding:10px 28px 0;font-size:14.5px;line-height:1.7;color:#475569;text-align:${align}">${esc(p)}</td></tr>`).join('');
  const list = details.length
    ? `<tr><td style="padding:16px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FC;border:1px solid #E3E8F0;border-radius:10px">${details
        .map(([k, v]) => `<tr><td style="padding:9px 14px;font-size:12.5px;color:#64748B;width:38%;text-align:${align}">${esc(k)}</td><td style="padding:9px 14px;font-size:13.5px;color:#0F172A;font-weight:600;text-align:${align}">${esc(v)}</td></tr>`)
        .join('')}</table></td></tr>`
    : '';
  const cta = button
    ? `<tr><td align="center" style="padding:24px 28px 6px"><a href="${esc(button.url)}" style="display:inline-block;background:#1B4DA8;color:#ffffff;text-decoration:none;font-weight:700;font-size:14.5px;padding:13px 26px;border-radius:10px">${esc(button.label)}</a></td></tr>
<tr><td style="padding:10px 28px 0;font-size:11.5px;line-height:1.6;color:#94A3B8;text-align:center;word-break:break-all">${lang === 'ar' ? 'لو الزرار مش شغال، انسخ الرابط ده:' : "If the button doesn't work, copy this link:"}<br><span dir="ltr">${esc(button.url)}</span></td></tr>`
    : '';
  const html = `<!doctype html><html dir="${dir}" lang="${lang}"><body style="margin:0;background:#F4F6FA;font-family:Segoe UI,Tahoma,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #E3E8F0;border-radius:14px;overflow:hidden" cellpadding="0" cellspacing="0">
<tr><td style="height:5px;background:#1B4DA8;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:22px 28px 6px;font-size:15px;font-weight:700;color:#1B4DA8;text-align:${align}">${header}</td></tr>
<tr><td style="padding:8px 28px 0;font-size:21px;font-weight:700;color:#0F172A;text-align:${align}">${esc(title)}</td></tr>
${paras}${list}${cta}
<tr><td style="padding:24px 28px 26px;font-size:12px;line-height:1.6;color:#94A3B8;text-align:${align}">${esc(foot)}</td></tr>
</table>
<div style="font-size:11px;color:#A0AEC0;padding-top:14px">${esc(app)}</div>
</td></tr></table></body></html>`;
  const text = [title, '', ...paragraphs, ...details.map(([k, v]) => `${k}: ${v}`), button ? `\n${button.label}: ${button.url}` : '', '', foot]
    .filter((line) => line !== undefined)
    .join('\n');
  return { subject, html, text };
}

/**
 * Sends a templated email and never throws: the calling action (approving a
 * request, confirming an import...) must not fail because email is down.
 * Returns 'sent' | 'logged' (no SMTP configured) | 'failed'.
 */
export async function sendTemplated(to, parts) {
  try {
    const result = await sendMail({ to, ...renderEmail(parts) });
    return result.delivered ? 'sent' : 'logged';
  } catch (error) {
    logger.warn({ to, err: error.message }, '[mail] could not send email');
    return 'failed';
  }
}
