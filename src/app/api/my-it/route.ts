import { NextResponse } from "next/server";
import { q, one } from "@/lib/server/db";
import { requireUser, handle } from "@/lib/server/auth";
import { MAILBOX_QUOTA_MB } from "@/lib/server/schema";

/** Everything the automations manage for the signed-in employee. */
export const GET = handle(async () => {
  const user = await requireUser();
  const [account, software, vpn, jobs, printers, mailbox] = await Promise.all([
    one<{ failed_logins: number; locked_until: string | null; mfa: boolean; mfa_pending: boolean }>(
      "select failed_logins, locked_until, mfa_secret is not null as mfa, (mfa_pending_secret is not null and mfa_pending_expires > now()) as mfa_pending from users where id = $1",
      [user.id],
    ),
    q("select id, app, status, pre_approved, created_at, decided_at from software_requests where user_id = $1 order by created_at desc", [user.id]),
    q("select id, serial, address, issued_at, expires_at, revoked_at from vpn_profiles where user_id = $1 order by issued_at desc limit 5", [user.id]),
    q(
      "select j.id, j.document, j.pages, j.status, j.created_at, p.name as printer from print_jobs j join printers p on p.id = j.printer_id where j.user_id = $1 order by j.created_at desc limit 10",
      [user.id],
    ),
    q("select id, name, status, restarted_at from printers order by id"),
    one<{ mailbox: string; archive: string }>(
      "select coalesce(sum(size_mb) filter (where location = 'mailbox'),0)::text as mailbox, coalesce(sum(size_mb) filter (where location = 'archive'),0)::text as archive from mailbox_folders where user_id = $1",
      [user.id],
    ),
  ]);
  return NextResponse.json({
    user: { name: user.name, email: user.email },
    account,
    software,
    vpn,
    jobs,
    printers,
    mailbox: { usedMb: Number(mailbox?.mailbox ?? 0), archiveMb: Number(mailbox?.archive ?? 0), quotaMb: MAILBOX_QUOTA_MB },
  });
});
