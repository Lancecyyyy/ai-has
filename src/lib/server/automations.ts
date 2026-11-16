import "server-only";
import { q, one } from "./db";
import { extractSoftware } from "../ai/intents";
import type { SessionUser } from "./auth";

export interface Step {
  label: string;
  detail: string;
  ms: number;
  ok: boolean;
}

export const WORKFLOWS: { id: string; name: string; description: string; minutes: number }[] = [
  { id: "password_reset", name: "Password reset", description: "Verifies the signed-in employee, then sends a one-time reset link to their registered email.", minutes: 12 },
  { id: "account_unlock", name: "Account unlock", description: "Checks the lockout reason in the directory and clears the failed-attempt counter.", minutes: 10 },
  { id: "mfa_reset", name: "MFA re-enrollment", description: "Removes the old authenticator and issues a 24-hour enrollment QR code.", minutes: 15 },
  { id: "vpn_reset", name: "VPN profile re-issue", description: "Revokes the old VPN certificate and pushes a fresh profile through device management.", minutes: 18 },
  { id: "software_access", name: "Software provisioning", description: "Installs pre-approved apps instantly; routes licensed apps to the manager for approval.", minutes: 20 },
  { id: "print_queue", name: "Print queue reset", description: "Purges stuck jobs for the employee and restarts the print spooler on the FollowMe queue.", minutes: 8 },
  { id: "mailbox_cleanup", name: "Mailbox cleanup", description: "Moves mail older than 12 months to the unlimited Online Archive.", minutes: 10 },
];

function mask(email: string) {
  const [u, d] = email.split("@");
  return `${u[0]}${"*".repeat(Math.max(2, u.length - 2))}${u.slice(-1)}@${d}`;
}

function rand(seed: string, min: number, max: number) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return min + (Math.abs(h) % (max - min + 1));
}

/**
 * Simulated connectors: each step mirrors what the real integration would do
 * (directory, MDM, license pool). Every run is also forwarded to
 * AUTOMATION_WEBHOOK_URL so n8n / Make can execute the real thing.
 */
export function planRun(workflowId: string, user: SessionUser, context: string): { status: "success" | "pending_approval"; summary: string; steps: Step[] } {
  const s = (label: string, detail: string, ms: number): Step => ({ label, detail, ms, ok: true });
  const stamp = new Date().toISOString();
  switch (workflowId) {
    case "password_reset":
      return {
        status: "success",
        summary: `Reset link sent to ${mask(user.email)}. It expires in 15 minutes.`,
        steps: [
          s("Verify identity", `Active SSO session for ${user.name} confirmed`, 420),
          s("Check directory", "Account enabled, not on legal hold", 380),
          s("Generate one-time link", "Token issued, valid 15 minutes", 520),
          s("Deliver link", `Emailed to ${mask(user.email)}`, 460),
          s("Write audit trail", `Logged at ${stamp}`, 240),
        ],
      };
    case "account_unlock":
      return {
        status: "success",
        summary: "Your account is unlocked. Sign in again with your current password.",
        steps: [
          s("Verify identity", "Session and device fingerprint match", 400),
          s("Read lockout reason", `${rand(user.email + stamp, 5, 9)} failed attempts from a saved credential`, 520),
          s("Clear lockout counter", "Directory attribute badPwdCount reset", 380),
          s("Notify employee", "Confirmation sent to Teams", 300),
        ],
      };
    case "mfa_reset":
      return {
        status: "success",
        summary: "Old authenticator removed. Open mysignins.meridian.example within 24 hours to scan your new QR code.",
        steps: [
          s("Verify identity", "Session confirmed, manager notified", 450),
          s("Remove old method", "Authenticator on previous device revoked", 520),
          s("Issue enrollment code", "QR enrollment valid for 24 hours", 480),
          s("Notify employee", `Instructions emailed to ${mask(user.email)}`, 300),
        ],
      };
    case "vpn_reset":
      return {
        status: "success",
        summary: "A new VPN profile was pushed to your laptop. Quit and reopen GlobalConnect to load it.",
        steps: [
          s("Locate device", `MNL-LT-${rand(user.email, 1000, 9999)} found in device management`, 460),
          s("Revoke old certificate", "Previous certificate added to revocation list", 520),
          s("Issue new profile", "Certificate valid for 365 days", 560),
          s("Push via MDM", "Profile delivered, device acknowledged", 640),
        ],
      };
    case "software_access": {
      const app = extractSoftware(context);
      if (!app)
        return {
          status: "pending_approval",
          summary: "I couldn't match an app in the catalog, so a request was sent to IT to review.",
          steps: [s("Search catalog", "No exact match", 380), s("Create review request", "Routed to IT Service Desk", 300)],
        };
      if (app.preApproved)
        return {
          status: "success",
          summary: `${app.name} is being installed. It will appear in your Start menu within 10 minutes.`,
          steps: [
            s("Match catalog", `${app.name} — pre-approved`, 360),
            s("Check license pool", "No license required", 280),
            s("Assign to device", "Install job queued in Company Portal", 520),
            s("Notify employee", "You'll get a Teams message when it's done", 260),
          ],
        };
      return {
        status: "pending_approval",
        summary: `${app.name} needs a paid license, so I sent an approval request to your manager. You'll get access within 30 minutes of approval.`,
        steps: [
          s("Match catalog", `${app.name} — requires approval`, 360),
          s("Check license pool", `${rand(app.name, 3, 14)} seats available`, 420),
          s("Request manager approval", "Sent via email and Teams", 480),
          s("Schedule provisioning", "Runs automatically after approval", 300),
        ],
      };
    }
    case "print_queue":
      return {
        status: "success",
        summary: "Your stuck print jobs were cleared and the spooler restarted. Try printing again to FollowMe.",
        steps: [
          s("Find your jobs", `${rand(user.email + stamp, 1, 4)} stuck jobs on FollowMe`, 380),
          s("Purge queue", "Jobs cancelled", 420),
          s("Restart spooler", "Print service restarted on PRN-SRV-02", 600),
        ],
      };
    case "mailbox_cleanup":
      return {
        status: "success",
        summary: `Archived ${rand(user.email + stamp, 4, 19)}.${rand(stamp, 1, 9)} GB of mail older than 12 months. Your mailbox has room again.`,
        steps: [
          s("Measure mailbox", "47.8 GB of 50 GB used", 420),
          s("Apply archive policy", "Items older than 12 months selected", 520),
          s("Move to Online Archive", "Folder structure preserved", 820),
          s("Report", "Summary sent to your inbox", 260),
        ],
      };
    default:
      throw new Error("Unknown workflow");
  }
}

export async function isEnabled(workflowId: string) {
  const row = await one<{ enabled: boolean }>("select enabled from automations where id = $1", [workflowId]);
  return !!row?.enabled;
}

export async function recordRun(args: {
  workflowId: string;
  userId: number;
  conversationId: string | null;
  status: string;
  summary: string;
  steps: Step[];
}) {
  const duration = args.steps.reduce((s, x) => s + x.ms, 0);
  const [row] = await q<{ id: number }>(
    `insert into automation_runs (workflow_id, user_id, conversation_id, status, summary, steps, duration_ms)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7) returning id`,
    [args.workflowId, args.userId, args.conversationId, args.status, args.summary, JSON.stringify(args.steps), duration],
  );
  void forward(process.env.AUTOMATION_WEBHOOK_URL, { event: "automation.run", id: row.id, ...args, duration_ms: duration });
  return row.id;
}

export async function forward(url: string | undefined, payload: unknown) {
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Webhooks are best-effort; the run is already recorded locally.
  }
}
