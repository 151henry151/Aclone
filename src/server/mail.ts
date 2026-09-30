// SPDX-License-Identifier: GPL-3.0-or-later
import nodemailer from 'nodemailer';
import type { Mailer } from './accounts.ts';
/** Credentials are operator configuration, never sent to the browser or logged. */
export function configuredMailer(): Mailer | undefined {
  if (!process.env.SMTP_HOST || !process.env.MAIL_FROM || !process.env.PUBLIC_ORIGIN) return;
  const origin = new URL(process.env.PUBLIC_ORIGIN);
  if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname))
    throw Error('Email recovery requires an HTTPS PUBLIC_ORIGIN');
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === '465',
    requireTLS: process.env.SMTP_PORT !== '465',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return async (to, link, purpose, pilot) => {
    await transport.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject:
        purpose === 'verify' ? 'Verify your Aclone recovery email' : 'Reset your Aclone password',
      text: `For Aclone pilot ${pilot}:\n\n${purpose === 'verify' ? 'Confirm this address for your Aclone pilot' : 'Reset your Aclone password'}:\n\n${link}\n\nThis link can be used once and expires in ${purpose === 'verify' ? '24 hours' : '30 minutes'}. If you did not request it, ignore this email.`,
    });
  };
}
