import "server-only";
import type { Db } from "./db";
import { DEMO_ACCOUNTS } from "./seed";
import { WORKFLOWS } from "./automations";

/**
 * The records the automations act on: printers and print jobs, and mailbox
 * folders. The demo employee starts with stuck jobs and a nearly full mailbox
 * so every automation has real work to do; "Reset demo records" restores that.
 */

const PRINTERS: [string, string][] = [
  ["followme", "FollowMe (all floors)"],
  ["prn-3f-color", "3F Color MFP"],
];

const DEMO_JOBS: [string, number][] = [
  ["Q3 campaign brief.pdf", 12],
  ["Event floor plan.pdf", 2],
  ["Expense receipts.xlsx", 1],
];

const FOLDERS: [string, number][] = [
  ["Inbox", 1.0],
  ["Sent Items", 0.55],
  ["Campaign assets", 0.5],
];

function monthStart(offset: number) {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - offset, 1)).toISOString().slice(0, 10);
}

async function demoEmployee(db: Db) {
  const [u] = await db.query<{ id: number }>("select id from users where email = $1", [DEMO_ACCOUNTS.employee]);
  return u?.id ?? null;
}

export async function ensureRecords(db: Db) {
  for (const w of WORKFLOWS) await db.query("update automations set description = $2 where id = $1 and description <> $2", [w.id, w.description]);
  for (const [id, name] of PRINTERS) {
    await db.query("insert into printers (id, name) values ($1,$2) on conflict (id) do nothing", [id, name]);
  }
  const uid = await demoEmployee(db);
  if (!uid) return;

  const [{ n: jobs }] = await db.query<{ n: number }>("select count(*)::int as n from print_jobs where user_id = $1", [uid]);
  if (jobs === 0) {
    for (const [i, [doc, pages]] of DEMO_JOBS.entries()) {
      await db.query("insert into print_jobs (user_id, printer_id, document, pages, status, created_at) values ($1,'followme',$2,$3,'stuck', now() - ($4 || ' minutes')::interval)", [
        uid,
        doc,
        pages,
        String(25 + i * 7),
      ]);
    }
    await db.query("update printers set status = 'error' where id = 'followme'");
  }

  const [{ n: folders }] = await db.query<{ n: number }>("select count(*)::int as n from mailbox_folders where user_id = $1", [uid]);
  if (folders === 0) {
    // 30 months of mail, about 47.8 GB in total, heavier in recent months.
    for (let m = 0; m < 30; m++) {
      for (const [f, weight] of FOLDERS) {
        const size = Math.round((600 + ((m * 37 + f.length * 53) % 300)) * weight * 10) / 10;
        const items = Math.round(size * 3.1);
        await db.query("insert into mailbox_folders (user_id, folder, month, items, size_mb) values ($1,$2,$3,$4,$5)", [uid, f, monthStart(m), items, size]);
      }
    }
  }
}

/**
 * Puts the demo employee back to the starting state so every automation can be
 * shown again: stuck print jobs, nearly full mailbox, no software or VPN
 * profile, no authenticator, not locked, no outstanding reset links.
 */
export async function resetDemoRecords(db: Db) {
  const uid = await demoEmployee(db);
  if (!uid) return;
  await db.query("delete from print_jobs where user_id = $1", [uid]);
  await db.query("delete from mailbox_folders where user_id = $1", [uid]);
  await db.query("delete from software_requests where user_id = $1", [uid]);
  await db.query("delete from vpn_profiles where user_id = $1", [uid]);
  await db.query("update password_resets set used_at = now() where user_id = $1 and used_at is null", [uid]);
  await db.query(
    "update users set failed_logins = 0, locked_until = null, mfa_secret = null, mfa_pending_secret = null, mfa_pending_expires = null where id = $1",
    [uid],
  );
  await ensureRecords(db);
}
