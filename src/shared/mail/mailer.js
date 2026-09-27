import nodemailer from 'nodemailer';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';

/**
 * Outgoing email. Uses SMTP (Gmail by default, with a Google App Password).
 * When SMTP credentials are not configured (local development) the message
 * is written to the server log instead, so flows stay testable offline.
 */
let transporter = null;

export function mailConfigured() {
  return Boolean(config.mail.user && config.mail.pass);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: { user: config.mail.user, pass: config.mail.pass },
      pool: true,
      maxConnections: 3,
      // Gmail allows ~500 emails/day on a normal account; keep a steady pace.
      rateDelta: 1000,
      rateLimit: 5,
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured()) {
    logger.warn({ to, subject }, `[mail] SMTP not configured - email not sent. Content:\n${text}`);
    return { delivered: false, logged: true };
  }
  const info = await getTransporter().sendMail({ from: config.mail.from, to, subject, text, html });
  logger.info({ to, subject, messageId: info.messageId }, '[mail] sent');
  return { delivered: true, messageId: info.messageId };
}

/** Verifies the SMTP login at startup so a wrong App Password is visible early. */
export async function verifyMailTransport() {
  if (!mailConfigured()) {
    logger.warn('[mail] SMTP_USER/SMTP_PASS not set: emails will be printed to the log');
    return false;
  }
  try {
    await getTransporter().verify();
    logger.info(`[mail] SMTP ready (${config.mail.host} as ${config.mail.user})`);
    return true;
  } catch (error) {
    logger.error({ err: error.message }, '[mail] SMTP login failed - check SMTP_USER / SMTP_PASS (Google App Password)');
    return false;
  }
}
