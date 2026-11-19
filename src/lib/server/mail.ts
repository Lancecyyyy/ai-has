import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { q } from "./db";

/**
 * Outgoing email through Gmail SMTP (GMAIL_USER + GMAIL_APP_PASSWORD) or any
 * SMTP server (SMTP_URL). Without either, development servers print the email
 * to the server log so flows can still be tested; production reports a failure.
 */

let transport: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (transport !== undefined) return transport;
  if (process.env.SMTP_URL) transport = nodemailer.createTransport(process.env.SMTP_URL);
  else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
    transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, "") },
    });
  else transport = null;
  return transport;
}

export function mailConfigured() {
  return !!(process.env.SMTP_URL || (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD));
}

const FAKE_DOMAIN = /@[^@]+\.(example|test|invalid|localhost)$/i;

/**
 * Where an account's mail is actually delivered. Demo accounts use made-up
 * addresses, so DEMO_INBOX redirects them to a real inbox for demonstrations.
 */
export function deliveryAddress(email: string): string | null {
  if (!FAKE_DOMAIN.test(email)) return email;
  return process.env.DEMO_INBOX?.trim() || null;
}

export function maskEmail(email: string) {
  const [u, d] = email.split("@");
  if (!d) return email;
  return `${u[0]}${"*".repeat(Math.max(2, u.length - 2))}${u.slice(-1)}@${d}`;
}

export interface MailResult {
  ok: boolean;
  to: string | null;
  detail: string;
}

function html(title: string, paragraphs: string[], button?: { label: string; url: string }) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html><body style="margin:0;background:#f1f1ee;font-family:Arial,Helvetica,sans-serif;color:#121212">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e2dd" cellpadding="0" cellspacing="0">
<tr><td style="padding:28px 28px 8px"><div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#ff4d00;font-weight:bold">AI-HAS · Meridian IT</div>
<h1 style="font-size:22px;margin:12px 0 4px">${esc(title)}</h1></td></tr>
<tr><td style="padding:0 28px 8px;font-size:15px;line-height:1.55">${paragraphs.map((p) => `<p style="margin:12px 0">${esc(p)}</p>`).join("")}</td></tr>
${button ? `<tr><td style="padding:8px 28px 4px"><a href="${esc(button.url)}" style="display:inline-block;background:#ff4d00;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">${esc(button.label)}</a>
<p style="font-size:12px;color:#64645f;margin:14px 0 0;word-break:break-all">Or paste this link into your browser: ${esc(button.url)}</p></td></tr>` : ""}
<tr><td style="padding:20px 28px 26px;font-size:12px;color:#64645f">Sent automatically by the Meridian IT assistant. If you didn't ask for this, tell IT at once.</td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * Sends one notification to a user's account email. Never throws: the result
 * says whether it was delivered, so automations can report it honestly.
 */
export async function sendAccountMail(args: {
  accountEmail: string;
  subject: string;
  title: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  kind: string;
}): Promise<MailResult> {
  const to = deliveryAddress(args.accountEmail);
  const text = [args.title, "", ...args.paragraphs, ...(args.button ? ["", `${args.button.label}: ${args.button.url}`] : [])].join("\n");
  const log = async (status: string, detail: string) => {
    await q("insert into email_log (to_address, account_email, kind, subject, status, detail) values ($1,$2,$3,$4,$5,$6)", [
      to ?? "",
      args.accountEmail,
      args.kind,
      args.subject,
      status,
      detail.slice(0, 300),
    ]).catch(() => {});
  };

  if (!to) {
    const detail = `${args.accountEmail} is a demo address that can't receive mail. Set DEMO_INBOX to deliver demo mail.`;
    await log("failed", detail);
    return { ok: false, to: null, detail };
  }
  const t = getTransport();
  if (!t) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[ai-has mail] (not sent, no SMTP configured) to=${to}\nSubject: ${args.subject}\n${text}\n`);
      await log("logged", "Printed to the server log (development, no SMTP configured)");
      return { ok: true, to, detail: `Printed to the server log for ${to} (email not configured)` };
    }
    const detail = "Email isn't set up on this server (GMAIL_USER and GMAIL_APP_PASSWORD).";
    await log("failed", detail);
    return { ok: false, to, detail };
  }
  try {
    const from = process.env.MAIL_FROM || `Meridian IT (AI-HAS) <${process.env.GMAIL_USER ?? "no-reply@ai-has.local"}>`;
    await t.sendMail({ from, to, subject: args.subject, text, html: html(args.title, args.paragraphs, args.button) });
    await log("sent", "Delivered to the mail server");
    return { ok: true, to, detail: `Emailed to ${maskEmail(to)}` };
  } catch (err) {
    const detail = `The mail server refused it: ${(err as Error).message}`;
    console.error("[ai-has mail]", err);
    await log("failed", detail);
    return { ok: false, to, detail };
  }
}

export function appUrl(req?: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  if (req) return new URL(req.url).origin;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
