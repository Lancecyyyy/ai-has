import "server-only";
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes } from "node:crypto";
import { q, one } from "./db";
import type { SessionUser } from "./auth";
import type { Step } from "./automations";
import { extractSoftware } from "../ai/intents";
import { normalizeTaglish } from "../ai/taglish";
import { appUrl, maskEmail, sendAccountMail } from "./mail";
import { generateSecret } from "./totp";
import { MAILBOX_QUOTA_MB } from "./schema";

/**
 * The automations, for real. Every step changes or reads real records in the
 * AI-HAS database (accounts, VPN profiles, software requests, print jobs,
 * mailboxes) and sends real email, and each step reports what it actually did.
 */

export type RunStatus = "success" | "pending_approval" | "failed";
export interface RunResult {
  status: RunStatus;
  summary: string;
  steps: Step[];
}

class StepFailed extends Error {}

function recorder() {
  const steps: Step[] = [];
  async function step(label: string, fn: () => Promise<string>, fatal = true): Promise<boolean> {
    const t = Date.now();
    try {
      const detail = await fn();
      steps.push({ label, detail, ms: Date.now() - t, ok: true });
      return true;
    } catch (err) {
      steps.push({ label, detail: (err as Error).message, ms: Date.now() - t, ok: false });
      if (fatal) throw new StepFailed((err as Error).message);
      return false;
    }
  }
  return { steps, step };
}

const TZ = "Asia/Manila";
export const clock = (d: Date) => d.toLocaleTimeString("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const day = (d: Date) => d.toLocaleDateString("en-PH", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" });
const gb = (mb: number) => `${(mb / 1024).toFixed(1)} GB`;

async function audit(user: SessionUser, type: string, detail: string) {
  await q("insert into security_events (user_id, type, severity, detail) values ($1,$2,'low',$3)", [user.id, type, detail]);
  return "Recorded in the security log";
}

async function notify(user: SessionUser, kind: string, subject: string, title: string, paragraphs: string[], button?: { label: string; url: string }) {
  const r = await sendAccountMail({ accountEmail: user.email, subject, title, paragraphs, button, kind });
  if (!r.ok) throw new Error(r.detail);
  return r.detail;
}

// ---------------------------------------------------------------- password reset

export const RESET_TTL_MIN = 15;
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** Creates a single-use reset token and emails the link. Shared with "Forgot password". */
export async function issueResetLink(user: { id: number; name: string; email: string }, origin: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + RESET_TTL_MIN * 60_000);
  await q("update password_resets set used_at = now() where user_id = $1 and used_at is null", [user.id]);
  await q("insert into password_resets (token_hash, user_id, expires_at) values ($1,$2,$3)", [hashToken(token), user.id, expires.toISOString()]);
  const url = `${origin}/reset-password?token=${token}`;
  const mail = await sendAccountMail({
    accountEmail: user.email,
    kind: "password_reset",
    subject: "Your Meridian password reset link",
    title: "Reset your password",
    paragraphs: [
      `Hi ${user.name.split(" ")[0]}, here's the password reset link you asked for.`,
      `It works once and expires at ${clock(expires)} (${RESET_TTL_MIN} minutes). It also unlocks your account if it was locked.`,
    ],
    button: { label: "Choose a new password", url },
  });
  return { expires, mail };
}

async function passwordReset(user: SessionUser, origin: string): Promise<RunResult> {
  const { steps, step } = recorder();
  let to = "";
  try {
    await step("Verify identity", async () => `Signed-in session for ${user.name} confirmed`);
    await step("Check account", async () => {
      const a = await one<{ locked_until: string | null }>("select locked_until from users where id = $1", [user.id]);
      if (!a) throw new Error("Account not found");
      return a.locked_until && new Date(a.locked_until) > new Date() ? "Account active, currently locked (the link will unlock it)" : "Account active";
    });
    let expires = new Date();
    let mail: Awaited<ReturnType<typeof issueResetLink>>["mail"] | null = null;
    await step("Generate one-time link", async () => {
      const r = await issueResetLink(user, origin);
      expires = r.expires;
      mail = r.mail;
      return `Single-use token, expires at ${clock(expires)}; older links cancelled`;
    });
    await step("Email the link", async () => {
      const m = mail!;
      if (!m.ok) throw new Error(m.detail);
      to = m.to ?? "";
      return m.detail;
    });
    await step("Write audit trail", () => audit(user, "password_reset_link", `Reset link emailed to ${maskEmail(to)}`));
    return { status: "success", steps, summary: `I emailed a password reset link to **${maskEmail(to)}**. It works once and expires in ${RESET_TTL_MIN} minutes. Please don't type your new password here.` };
  } catch (e) {
    if (!(e instanceof StepFailed)) throw e;
    return { status: "failed", steps, summary: `I couldn't send the reset link: ${e.message} I can open a ticket for the IT team instead.` };
  }
}

// ---------------------------------------------------------------- account unlock

async function accountUnlock(user: SessionUser): Promise<RunResult> {
  const { steps, step } = recorder();
  let wasLocked = false;
  try {
    await step("Verify identity", async () => `Signed-in session for ${user.name} confirmed`);
    await step("Read lockout state", async () => {
      const a = await one<{ failed_logins: number; locked_until: string | null }>("select failed_logins, locked_until from users where id = $1", [user.id]);
      if (!a) throw new Error("Account not found");
      wasLocked = !!a.locked_until && new Date(a.locked_until) > new Date();
      return wasLocked ? `Locked until ${clock(new Date(a.locked_until!))} after ${a.failed_logins} failed sign-ins` : `Not locked (${a.failed_logins} failed sign-ins on record)`;
    });
    await step("Clear lockout", async () => {
      await q("update users set failed_logins = 0, locked_until = null where id = $1", [user.id]);
      return "Lock removed, failed sign-in counter set to 0";
    });
    await step(
      "Email confirmation",
      () =>
        notify(user, "account_unlock", "Your Meridian account was unlocked", "Your account is unlocked", [
          wasLocked ? "Your account was locked after too many wrong passwords. It's unlocked now, so you can sign in with your current password." : "You asked the IT assistant to unlock your account. It wasn't locked, and the failed sign-in counter has been reset.",
          "If you didn't ask for this, contact IT right away.",
        ]),
      false,
    );
    await step("Write audit trail", () => audit(user, "account_unlocked", wasLocked ? "Account unlocked by the employee through the assistant" : "Unlock requested; account was not locked"));
    return {
      status: "success",
      steps,
      summary: wasLocked
        ? "Your account is unlocked. You can sign in again with your current password."
        : "Your account wasn't locked, so there was nothing to unlock; I reset the failed sign-in counter anyway. If sign-in still fails, the password is probably the problem, and I can email you a reset link.",
    };
  } catch (e) {
    if (!(e instanceof StepFailed)) throw e;
    return { status: "failed", steps, summary: `I couldn't unlock the account: ${e.message}` };
  }
}

// ---------------------------------------------------------------- MFA re-enrollment

export const MFA_ENROLL_HOURS = 24;

async function mfaReset(user: SessionUser, origin: string): Promise<RunResult> {
  const { steps, step } = recorder();
  try {
    await step("Verify identity", async () => `Signed-in session for ${user.name} confirmed`);
    await step("Remove old authenticator", async () => {
      const a = await one<{ mfa_secret: string | null }>("select mfa_secret from users where id = $1", [user.id]);
      await q("update users set mfa_secret = null where id = $1", [user.id]);
      return a?.mfa_secret ? "Previous authenticator removed from your account" : "No authenticator was registered";
    });
    let expires = new Date();
    await step("Issue enrollment code", async () => {
      expires = new Date(Date.now() + MFA_ENROLL_HOURS * 3600_000);
      await q("update users set mfa_pending_secret = $2, mfa_pending_expires = $3 where id = $1", [user.id, generateSecret(), expires.toISOString()]);
      return `New QR enrollment, valid until ${day(expires)} ${clock(expires)}`;
    });
    const mailed = await step(
      "Email instructions",
      () =>
        notify(
          user,
          "mfa_reset",
          "Set up your new authenticator",
          "Set up your new authenticator",
          [
            "Your old authenticator was removed from your Meridian account.",
            `Open the link below within ${MFA_ENROLL_HOURS} hours, scan the QR code with Google or Microsoft Authenticator, and enter the 6-digit code it shows.`,
          ],
          { label: "Set up authenticator", url: `${origin}/mfa` },
        ),
      false,
    );
    await step("Write audit trail", () => audit(user, "mfa_reset", "Authenticator removed and new enrollment issued"));
    return {
      status: "success",
      steps,
      summary: `Your old authenticator is removed. [Set up your new authenticator](/mfa) within ${MFA_ENROLL_HOURS} hours: scan the QR code with your authenticator app and enter the 6-digit code.${mailed ? " I also emailed you the link." : ""}`,
    };
  } catch (e) {
    if (!(e instanceof StepFailed)) throw e;
    return { status: "failed", steps, summary: `I couldn't reset your MFA: ${e.message}` };
  }
}

// ---------------------------------------------------------------- VPN profile

const X25519_PKCS8 = Buffer.from("302e020100300506032b656e04220420", "hex");

function serverPublicKey() {
  const seed = createHash("sha256").update(`ai-has-vpn-server:${process.env.AUTH_SECRET ?? process.env.DATABASE_URL ?? "dev"}`).digest();
  const priv = createPrivateKey({ key: Buffer.concat([X25519_PKCS8, seed]), format: "der", type: "pkcs8" });
  return (createPublicKey(priv).export({ format: "der", type: "spki" }) as Buffer).subarray(-32).toString("base64");
}

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync("x25519");
  return {
    pub: (publicKey.export({ format: "der", type: "spki" }) as Buffer).subarray(-32).toString("base64"),
    priv: (privateKey.export({ format: "der", type: "pkcs8" }) as Buffer).subarray(-32).toString("base64"),
  };
}

export function vpnConfig(p: { private_key: string; address: string; serial: string; expires_at: string }) {
  return [
    `# Meridian Group VPN profile ${p.serial}`,
    `# Issued by the Meridian IT assistant. Valid until ${day(new Date(p.expires_at))}.`,
    "[Interface]",
    `PrivateKey = ${p.private_key}`,
    `Address = ${p.address}/32`,
    "DNS = 10.88.0.1",
    "",
    "[Peer]",
    `PublicKey = ${serverPublicKey()}`,
    "AllowedIPs = 10.0.0.0/8",
    `Endpoint = ${process.env.VPN_ENDPOINT || "vpn.meridian.example:51820"}`,
    "PersistentKeepalive = 25",
    "",
  ].join("\n");
}

async function vpnReset(user: SessionUser, origin: string): Promise<RunResult> {
  const { steps, step } = recorder();
  let id = 0;
  let revoked = 0;
  try {
    await step("Verify identity", async () => `Signed-in session for ${user.name} confirmed`);
    await step("Revoke old profile", async () => {
      const r = await q<{ serial: string }>("update vpn_profiles set revoked_at = now() where user_id = $1 and revoked_at is null returning serial", [user.id]);
      revoked = r.length;
      return r.length ? `Revoked ${r.map((x) => x.serial).join(", ")}` : "No active profile on record";
    });
    await step("Issue new profile", async () => {
      const { pub, priv } = keypair();
      const serial = `VPN-${randomBytes(3).toString("hex").toUpperCase()}`;
      const address = `10.88.${Math.floor(user.id / 250) % 250}.${(user.id % 250) + 2}`;
      const expires = new Date(Date.now() + 365 * 86400_000);
      const [row] = await q<{ id: number }>(
        "insert into vpn_profiles (user_id, serial, public_key, private_key, address, expires_at) values ($1,$2,$3,$4,$5,$6) returning id",
        [user.id, serial, pub, priv, address, expires.toISOString()],
      );
      id = row.id;
      return `${serial}: new WireGuard key pair, address ${address}, valid until ${day(expires)}`;
    });
    const mailed = await step(
      "Email download link",
      () =>
        notify(
          user,
          "vpn_reset",
          "Your new VPN profile is ready",
          "Your new VPN profile is ready",
          ["Your old VPN profile was revoked and a new one was issued.", "Download it while signed in to AI-HAS, then import it in your VPN app (WireGuard). The old profile no longer works."],
          { label: "Download VPN profile", url: `${origin}/api/vpn/profile/${id}` },
        ),
      false,
    );
    await step("Write audit trail", () => audit(user, "vpn_profile_reissued", "Old VPN profile revoked and a new one issued"));
    return {
      status: "success",
      steps,
      summary: `New VPN profile issued${revoked ? " and the old one revoked" : ""}. [Download your VPN profile](/api/vpn/profile/${id}), then import it in your VPN app.${mailed ? " I also emailed you the link." : ""}`,
    };
  } catch (e) {
    if (!(e instanceof StepFailed)) throw e;
    return { status: "failed", steps, summary: `I couldn't re-issue the VPN profile: ${e.message}` };
  }
}

// ---------------------------------------------------------------- software

export const LICENSE_SEATS: Record<string, number> = { Figma: 25, "Adobe Creative Cloud": 15, Tableau: 10, Salesforce: 40, Jira: 60, "Power BI": 30 };

async function seatsUsed(app: string) {
  const r = await one<{ n: number }>("select count(*)::int as n from software_requests where app = $1 and status = 'installed'", [app]);
  return r?.n ?? 0;
}

async function softwareAccess(user: SessionUser, context: string, conversationId: string | null, origin: string): Promise<RunResult> {
  const { steps, step } = recorder();
  const app = extractSoftware(normalizeTaglish(context));
  try {
    await step("Match catalog", async () => {
      if (!app) throw new Error("No app in the request matches the software catalog");
      return `${app.name}: ${app.preApproved ? "pre-approved for everyone" : "paid license, needs manager approval"}`;
    });
    const name = app!.name;
    const existing = await one<{ status: string }>("select status from software_requests where user_id = $1 and app = $2 and status in ('installed','pending') order by id desc limit 1", [user.id, name]);
    if (existing) {
      await step("Check your software", async () => (existing.status === "installed" ? `${name} is already assigned to you` : `A request for ${name} is already waiting for approval`));
      return {
        status: existing.status === "installed" ? "success" : "pending_approval",
        steps,
        summary: existing.status === "installed" ? `${name} is already assigned to your account. You can see it under [My IT](/my-it).` : `Your ${name} request is already waiting for your manager's approval. I'll message you here when it's decided.`,
      };
    }
    if (app!.preApproved) {
      await step("Check license pool", async () => "No license needed");
      await step("Assign to your account", async () => {
        await q("insert into software_requests (user_id, conversation_id, app, pre_approved, status, decided_at) values ($1,$2,$3,true,'installed',now())", [user.id, conversationId, name]);
        return `${name} added to your software list`;
      });
      await step("Email confirmation", () => notify(user, "software", `${name} is ready`, `${name} is ready`, [`${name} is pre-approved, so it was assigned to your account right away.`, "You'll find it under My IT in AI-HAS."], { label: "Open My IT", url: `${origin}/my-it` }), false);
      return { status: "success", steps, summary: `${name} is pre-approved, so I assigned it to your account. It's listed under [My IT](/my-it).` };
    }
    await step("Check license pool", async () => {
      const seats = LICENSE_SEATS[name] ?? 10;
      const used = await seatsUsed(name);
      return `${used} of ${seats} seats in use${used >= seats ? " (pool full, IT will add a seat)" : ""}`;
    });
    const managers = await q<{ name: string; email: string }>("select name, email from users where role = 'manager' order by id");
    await step("Create approval request", async () => {
      await q("insert into software_requests (user_id, conversation_id, app, pre_approved, status) values ($1,$2,$3,false,'pending')", [user.id, conversationId, name]);
      return `Request for ${name} saved, waiting for approval`;
    });
    await step(
      "Notify your manager",
      async () => {
        if (!managers.length) throw new Error("No manager account to approve it");
        const results = await Promise.all(
          managers.map((m) =>
            sendAccountMail({
              accountEmail: m.email,
              kind: "software_approval",
              subject: `Approval needed: ${name} for ${user.name}`,
              title: `${user.name} is asking for ${name}`,
              paragraphs: [`${user.name} (${user.department}) asked the IT assistant for ${name}, which uses a paid license.`, "Approve or decline it on the Automations page in AI-HAS."],
              button: { label: "Review request", url: `${origin}/automations` },
            }),
          ),
        );
        const sent = results.filter((r) => r.ok).length;
        if (!sent) throw new Error(results[0]?.detail ?? "Email failed");
        return `Emailed ${managers.map((m) => m.name).join(", ")}; also listed on the Automations page`;
      },
      false,
    );
    return { status: "pending_approval", steps, summary: `${name} uses a paid license, so I sent the request to ${managers[0]?.name ?? "your manager"} for approval. I'll message you here and by email as soon as it's decided.` };
  } catch (e) {
    if (!(e instanceof StepFailed)) throw e;
    return { status: "failed", steps, summary: app ? `I couldn't request ${app.name}: ${e.message}` : "I couldn't tell which app you need. Tell me its name (for example Figma, Zoom or Tableau) and I'll request it." };
  }
}

// ---------------------------------------------------------------- print queue

async function printQueue(user: SessionUser): Promise<RunResult> {
  const { steps, step } = recorder();
  let jobs: { id: number; document: string; pages: number; printer_id: string }[] = [];
  try {
    await step("Verify identity", async () => `Signed-in session for ${user.name} confirmed`);
    await step("Find your jobs", async () => {
      jobs = await q("select id, document, pages, printer_id from print_jobs where user_id = $1 and status in ('stuck','queued') order by created_at", [user.id]);
      return jobs.length ? `${jobs.length} stuck: ${jobs.map((j) => j.document).join(", ")}` : "No stuck jobs in your queue";
    });
    if (jobs.length) {
      await step("Clear the queue", async () => {
        await q("update print_jobs set status = 'cancelled', cleared_at = now() where id = any($1::int[])", [`{${jobs.map((j) => j.id).join(",")}}`]);
        return `${jobs.length} jobs cancelled (${jobs.reduce((s, j) => s + j.pages, 0)} pages)`;
      });
    }
    await step("Restart print queue", async () => {
      const ids = [...new Set(jobs.map((j) => j.printer_id).concat("followme"))];
      const r = await q<{ name: string }>("update printers set status = 'ready', restarted_at = now() where id = any($1::text[]) returning name", [`{${ids.join(",")}}`]);
      return `${r.map((x) => x.name).join(", ")} restarted, status Ready`;
    });
    await step(
      "Email confirmation",
      () =>
        notify(user, "print_queue", "Your print queue was cleared", "Your print queue was cleared", [
          jobs.length ? `These stuck jobs were cancelled: ${jobs.map((j) => j.document).join(", ")}.` : "There were no stuck jobs in your queue.",
          "The FollowMe queue was restarted. Send your document again and release it at any printer with your badge.",
        ]),
      false,
    );
    return {
      status: "success",
      steps,
      summary: jobs.length
        ? `I cleared ${jobs.length} stuck jobs (${jobs.map((j) => j.document).join(", ")}) and restarted the FollowMe queue. Send your document again and release it with your badge.`
        : "Your print queue was already empty; I restarted the FollowMe queue anyway. Try printing again, and if it still fails I can open a ticket.",
    };
  } catch (e) {
    if (!(e instanceof StepFailed)) throw e;
    return { status: "failed", steps, summary: `I couldn't clear the print queue: ${e.message}` };
  }
}

// ---------------------------------------------------------------- mailbox

async function mailboxCleanup(user: SessionUser): Promise<RunResult> {
  const { steps, step } = recorder();
  const used = async () => Number((await one<{ mb: string }>("select coalesce(sum(size_mb),0)::text as mb from mailbox_folders where user_id = $1 and location = 'mailbox'", [user.id]))?.mb ?? 0);
  let before = 0;
  let moved = { mb: 0, items: 0, months: 0 };
  try {
    await step("Measure mailbox", async () => {
      before = await used();
      return `${gb(before)} of ${gb(MAILBOX_QUOTA_MB)} used (${Math.round((before / MAILBOX_QUOTA_MB) * 100)}%)`;
    });
    await step("Apply archive policy", async () => {
      const r = await one<{ mb: string; items: string; months: string }>(
        "select coalesce(sum(size_mb),0)::text as mb, coalesce(sum(items),0)::text as items, count(distinct month)::text as months from mailbox_folders where user_id = $1 and location = 'mailbox' and month < (date_trunc('month', now()) - interval '12 months')",
        [user.id],
      );
      moved = { mb: Number(r?.mb ?? 0), items: Number(r?.items ?? 0), months: Number(r?.months ?? 0) };
      return moved.items ? `${moved.items.toLocaleString()} items from ${moved.months} months older than 12 months (${gb(moved.mb)})` : "Nothing older than 12 months";
    });
    if (moved.items) {
      await step("Move to Online Archive", async () => {
        await q("update mailbox_folders set location = 'archive' where user_id = $1 and location = 'mailbox' and month < (date_trunc('month', now()) - interval '12 months')", [user.id]);
        return "Moved; folders kept, nothing deleted";
      });
    }
    const after = await used();
    await step("Measure again", async () => `${gb(after)} of ${gb(MAILBOX_QUOTA_MB)} used (${Math.round((after / MAILBOX_QUOTA_MB) * 100)}%)`);
    await step(
      "Email summary",
      () =>
        notify(user, "mailbox_cleanup", "Your mailbox cleanup is done", "Your mailbox cleanup is done", [
          moved.items ? `${moved.items.toLocaleString()} items (${gb(moved.mb)}) older than 12 months were moved to your Online Archive. Nothing was deleted.` : "Nothing in your mailbox was older than 12 months, so nothing was moved.",
          `Your mailbox now uses ${gb(after)} of ${gb(MAILBOX_QUOTA_MB)}.`,
        ]),
      false,
    );
    return {
      status: "success",
      steps,
      summary: moved.items
        ? `I moved ${moved.items.toLocaleString()} items (${gb(moved.mb)}) older than 12 months to your Online Archive. Your mailbox went from ${gb(before)} to ${gb(after)} of ${gb(MAILBOX_QUOTA_MB)}. Nothing was deleted.`
        : `Nothing in your mailbox is older than 12 months, so there was nothing to archive. You're using ${gb(after)} of ${gb(MAILBOX_QUOTA_MB)}.`,
    };
  } catch (e) {
    if (!(e instanceof StepFailed)) throw e;
    return { status: "failed", steps, summary: `I couldn't clean up the mailbox: ${e.message}` };
  }
}

// ----------------------------------------------------------------

export async function runWorkflow(workflowId: string, user: SessionUser, ctx: { context: string; origin?: string; conversationId: string | null; req?: Request }): Promise<RunResult> {
  const origin = ctx.origin ?? appUrl(ctx.req);
  switch (workflowId) {
    case "password_reset":
      return passwordReset(user, origin);
    case "account_unlock":
      return accountUnlock(user);
    case "mfa_reset":
      return mfaReset(user, origin);
    case "vpn_reset":
      return vpnReset(user, origin);
    case "software_access":
      return softwareAccess(user, ctx.context, ctx.conversationId, origin);
    case "print_queue":
      return printQueue(user);
    case "mailbox_cleanup":
      return mailboxCleanup(user);
    default:
      throw new Error("Unknown workflow");
  }
}
