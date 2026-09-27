import crypto from 'node:crypto';
import User from './user.model.js';
import { config } from '../../config/index.js';
import { sendMail } from '../../shared/mail/mailer.js';
import { UnprocessableEntityError, TooManyRequestsError } from '../../shared/errors/index.js';

/**
 * 6-digit email codes for "verify your email" and "reset your password".
 * - only a SHA-256 hash (salted with the user id + purpose) is stored;
 * - codes expire (EMAIL_CODE_TTL_MINUTES, default 15);
 * - 5 wrong tries burn the code; a new one can be sent after 60 seconds.
 */
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

const hashCode = (userId, purpose, code) =>
  crypto.createHash('sha256').update(`${userId}:${purpose}:${code}:${config.jwt?.accessSecret ?? ''}`).digest('hex');

function newCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

const COPY = {
  verify_email: {
    en: (name, code, ttl, app) => ({
      subject: `${app}: your verification code is ${code}`,
      title: 'Confirm your email',
      body: `Hi ${name}, use this code to confirm your email address on ${app}.`,
      foot: `The code expires in ${ttl} minutes. If you did not create an account, you can ignore this email.`,
    }),
    ar: (name, code, ttl, app) => ({
      subject: `${app}: كود التأكيد ${code}`,
      title: 'أكّد بريدك الإلكتروني',
      body: `أهلاً ${name}، استخدم الكود ده عشان تأكّد بريدك على ${app}.`,
      foot: `الكود صالح لمدة ${ttl} دقيقة. لو ما عملتش حساب، تجاهل الرسالة دي.`,
    }),
  },
  reset_password: {
    en: (name, code, ttl, app) => ({
      subject: `${app}: your password reset code is ${code}`,
      title: 'Reset your password',
      body: `Hi ${name}, use this code to choose a new password on ${app}.`,
      foot: `The code expires in ${ttl} minutes. If you did not ask for this, ignore this email; your password stays the same.`,
    }),
    ar: (name, code, ttl, app) => ({
      subject: `${app}: كود تغيير كلمة السر ${code}`,
      title: 'غيّر كلمة السر',
      body: `أهلاً ${name}، استخدم الكود ده عشان تختار كلمة سر جديدة على ${app}.`,
      foot: `الكود صالح لمدة ${ttl} دقيقة. لو ما طلبتش ده، تجاهل الرسالة وكلمة السر هتفضل زي ما هي.`,
    }),
  },
};

function render(user, purpose, code) {
  const lang = user.languagePreference === 'ar' ? 'ar' : 'en';
  const ttl = config.mail.codeTtlMinutes;
  const app = config.mail.appName;
  const copy = COPY[purpose][lang](user.firstName, code, ttl, app);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const html = `<!doctype html><html dir="${dir}"><body style="margin:0;background:#F4F6FA;font-family:Segoe UI,Tahoma,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border:1px solid #E3E8F0;border-radius:14px" cellpadding="0" cellspacing="0">
<tr><td style="padding:28px 28px 8px;font-size:18px;font-weight:700;color:#1B4DA8">${app}</td></tr>
<tr><td style="padding:8px 28px 0;font-size:20px;font-weight:700;color:#0F172A">${copy.title}</td></tr>
<tr><td style="padding:10px 28px 0;font-size:14px;line-height:1.6;color:#475569">${copy.body}</td></tr>
<tr><td align="center" style="padding:22px 28px"><div dir="ltr" style="display:inline-block;font-size:30px;letter-spacing:10px;font-weight:700;color:#0F172A;background:#EEF3FC;border-radius:10px;padding:14px 22px;font-family:Consolas,Menlo,monospace">${code}</div></td></tr>
<tr><td style="padding:0 28px 28px;font-size:12.5px;line-height:1.6;color:#94A3B8">${copy.foot}</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${copy.title}\n\n${copy.body}\n\n${code}\n\n${copy.foot}`;
  return { subject: copy.subject, html, text };
}

/** Creates a fresh code for `purpose`, replaces the old one and emails it. */
export async function issueCode(userId, purpose) {
  const user = await User.findById(userId).select('+emailCodes');
  if (!user) return null;
  const existing = (user.emailCodes ?? []).find((c) => c.purpose === purpose);
  if (existing && Date.now() - existing.sentAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.sentAt.getTime())) / 1000);
    throw new TooManyRequestsError(`Please wait ${wait} seconds before asking for a new code`);
  }
  const code = newCode();
  const entry = {
    purpose,
    codeHash: hashCode(user._id, purpose, code),
    expiresAt: new Date(Date.now() + config.mail.codeTtlMinutes * 60 * 1000),
    attempts: 0,
    sentAt: new Date(),
  };
  user.emailCodes = [...(user.emailCodes ?? []).filter((c) => c.purpose !== purpose), entry];
  await user.save();
  const message = render(user, purpose, code);
  await sendMail({ to: user.email, ...message });
  return { expiresInMinutes: config.mail.codeTtlMinutes };
}

/** Checks a code; on success removes it. Throws a clear 422 otherwise. */
export async function consumeCode(userId, purpose, code) {
  const user = await User.findById(userId).select('+emailCodes');
  const entry = user && (user.emailCodes ?? []).find((c) => c.purpose === purpose);
  if (!entry) throw new UnprocessableEntityError('This code is not valid. Ask for a new code');
  if (entry.expiresAt.getTime() < Date.now()) {
    user.emailCodes = user.emailCodes.filter((c) => c.purpose !== purpose);
    await user.save();
    throw new UnprocessableEntityError('This code has expired. Ask for a new code');
  }
  const given = Buffer.from(hashCode(user._id, purpose, String(code).trim()));
  const expected = Buffer.from(entry.codeHash);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    entry.attempts += 1;
    if (entry.attempts >= MAX_ATTEMPTS) {
      user.emailCodes = user.emailCodes.filter((c) => c.purpose !== purpose);
      await user.save();
      throw new UnprocessableEntityError('Too many wrong codes. Ask for a new code');
    }
    await user.save();
    throw new UnprocessableEntityError(`Wrong code. ${MAX_ATTEMPTS - entry.attempts} tries left`);
  }
  user.emailCodes = user.emailCodes.filter((c) => c.purpose !== purpose);
  await user.save();
  return user;
}
