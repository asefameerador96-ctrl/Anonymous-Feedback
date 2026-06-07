import nodemailer, { Transporter } from "nodemailer";

/**
 * Provider-agnostic SMTP email. Configure with env vars (any SMTP relay —
 * Brevo, SendGrid, Azure Communication Services, etc.):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *   SMTP_FROM   (optional; defaults to SMTP_USER)
 *   SMTP_SECURE ("true" to force TLS-on-connect; auto for port 465)
 *
 * If unset, isEmailConfigured() is false and the app falls back to the
 * mail-merge CSV export instead of one-click sending.
 */

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

let transporter: Transporter | null = null;

function getTransport(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export function fromAddress(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@anonvey.com";
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  await getTransport().sendMail({
    from: fromAddress(),
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

/** Verify SMTP credentials/connection without sending. */
export async function verifyEmail(): Promise<void> {
  await getTransport().verify();
}

/** Build the invitation email for a respondent. */
export function inviteEmail(orgName: string, link: string) {
  const subject = `${orgName}: your anonymous survey invitation`;
  const text =
    `You've been invited to an anonymous survey by ${orgName}.\n\n` +
    `Open your single-use link to take it:\n${link}\n\n` +
    `Your responses are completely anonymous — they can't be traced back to you. ` +
    `This link works only once.`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
    <p style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#6b7e6b">Anonvey · Truly Anonymous</p>
    <h1 style="font-size:24px;margin:8px 0 16px">You're invited to an anonymous survey</h1>
    <p style="line-height:1.6">${escapeHtml(orgName)} has invited you to share your honest, anonymous feedback.</p>
    <p style="margin:28px 0">
      <a href="${link}" style="background:#1a1a1a;color:#faf8f4;padding:12px 22px;text-decoration:none;display:inline-block">Take the survey</a>
    </p>
    <p style="font-size:13px;color:#555;line-height:1.6">
      Your responses are completely anonymous — they can't be traced back to you, even by ${escapeHtml(orgName)} or Anonvey. This link works only once.
    </p>
    <p style="font-size:12px;color:#999;word-break:break-all">${link}</p>
  </div>`;
  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}
