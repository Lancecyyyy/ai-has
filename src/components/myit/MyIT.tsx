"use client";
import Link from "next/link";
import { useState } from "react";
import { AppWindow, Download, KeyRound, Lock, Mail, Printer, ShieldCheck, Smartphone } from "lucide-react";
import { useToast } from "@/components/Providers";
import { Badge, Button, Card, CardHead, cx, Field, inputCls, PageHeader, Skeleton } from "@/components/ui";
import { api, timeAgo, useApi } from "@/lib/client/api";

interface MyItData {
  user: { name: string; email: string };
  account: { failed_logins: number; locked_until: string | null; mfa: boolean; mfa_pending: boolean } | null;
  software: { id: number; app: string; status: string; pre_approved: boolean; created_at: string; decided_at: string | null }[];
  vpn: { id: number; serial: string; address: string; issued_at: string; expires_at: string; revoked_at: string | null }[];
  jobs: { id: number; document: string; pages: number; status: string; created_at: string; printer: string }[];
  printers: { id: string; name: string; status: string; restarted_at: string | null }[];
  mailbox: { usedMb: number; archiveMb: number; quotaMb: number };
}

const SOFT_TONE: Record<string, "ok" | "warn" | "bad" | "neutral"> = { installed: "ok", pending: "warn", declined: "bad" };
const SOFT_LABEL: Record<string, string> = { installed: "Assigned", pending: "Waiting for approval", declined: "Declined" };
const JOB_TONE: Record<string, "ok" | "warn" | "bad" | "neutral"> = { stuck: "bad", queued: "warn", printed: "ok", cancelled: "neutral" };
const gb = (mb: number) => `${(mb / 1024).toFixed(1)} GB`;
const date = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

export function MyIT() {
  const { data, loading } = useApi<MyItData>("/api/my-it", { poll: 15000 });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader title="My IT" sub="Your account, software, VPN, printing and mailbox. The assistant's automations change what you see here." />
      {loading && !data ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : (
        data && (
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="p-5">
              <CardHead title="Account" sub={data.user.email} right={<ShieldCheck size={18} className="text-faint" />} />
              <ul className="mt-4 space-y-3 text-[14px]">
                <li className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-ink-2">
                    <Lock size={15} /> Sign-in
                  </span>
                  {data.account?.locked_until && new Date(data.account.locked_until) > new Date() ? (
                    <Badge tone="bad" dot>
                      Locked
                    </Badge>
                  ) : (
                    <Badge tone="ok" dot>
                      Active
                    </Badge>
                  )}
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-ink-2">
                    <KeyRound size={15} /> Failed sign-ins
                  </span>
                  <span className="font-mono">{data.account?.failed_logins ?? 0}</span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-ink-2">
                    <Smartphone size={15} /> Authenticator (MFA)
                  </span>
                  {data.account?.mfa ? (
                    <Badge tone="ok" dot>
                      On
                    </Badge>
                  ) : data.account?.mfa_pending ? (
                    <Link href="/mfa">
                      <Badge tone="warn" dot>
                        Finish setup
                      </Badge>
                    </Link>
                  ) : (
                    <Link href="/mfa">
                      <Badge dot>Off · set up</Badge>
                    </Link>
                  )}
                </li>
              </ul>
            </Card>

            <Card className="p-5">
              <CardHead title="Mailbox" sub="Mail older than 12 months can move to the Online Archive" right={<Mail size={18} className="text-faint" />} />
              <div className="mt-4">
                <div className="flex items-baseline justify-between text-[14px]">
                  <span className="font-display text-[28px] leading-none">{gb(data.mailbox.usedMb)}</span>
                  <span className="text-muted">of {gb(data.mailbox.quotaMb)}</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sunk">
                  <div
                    className={cx("h-full rounded-full", data.mailbox.usedMb / data.mailbox.quotaMb > 0.9 ? "bg-bad" : "bg-brand")}
                    style={{ width: `${Math.min(100, (data.mailbox.usedMb / data.mailbox.quotaMb) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[13px] text-muted">Online Archive: {gb(data.mailbox.archiveMb)}</p>
              </div>
            </Card>

            <Card className="p-5">
              <CardHead title="Software" sub="Apps assigned to you and requests in progress" right={<AppWindow size={18} className="text-faint" />} />
              {data.software.length ? (
                <ul className="mt-3 divide-y divide-line">
                  {data.software.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                      <span>
                        {s.app}
                        <span className="ml-2 text-[12px] text-faint">{timeAgo(s.decided_at ?? s.created_at)}</span>
                      </span>
                      <Badge tone={SOFT_TONE[s.status] ?? "neutral"} dot>
                        {SOFT_LABEL[s.status] ?? s.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[14px] text-muted">Nothing yet. Ask the assistant for an app, like “I need Figma”.</p>
              )}
            </Card>

            <Card className="p-5">
              <CardHead title="VPN profile" sub="Your WireGuard profile for remote access" right={<Download size={18} className="text-faint" />} />
              {data.vpn.length ? (
                <ul className="mt-3 divide-y divide-line">
                  {data.vpn.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                      <span className="min-w-0">
                        <span className="font-mono">{v.serial}</span>
                        <span className="ml-2 text-[12px] text-faint">{v.revoked_at ? `revoked ${timeAgo(v.revoked_at)}` : `valid until ${date(v.expires_at)}`}</span>
                      </span>
                      {v.revoked_at ? (
                        <Badge>Revoked</Badge>
                      ) : (
                        <a href={`/api/vpn/profile/${v.id}`}>
                          <Button size="sm" variant="primary" icon={<Download size={13} />}>
                            Download
                          </Button>
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[14px] text-muted">No profile yet. Ask the assistant to re-issue your VPN profile.</p>
              )}
            </Card>

            <Card className="p-5 md:col-span-2">
              <CardHead title="Printing" sub={data.printers.map((p) => `${p.name}: ${p.status === "ready" ? "Ready" : "Error"}`).join(" · ")} right={<Printer size={18} className="text-faint" />} />
              {data.jobs.length ? (
                <ul className="mt-3 divide-y divide-line">
                  {data.jobs.map((j) => (
                    <li key={j.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                      <span className="min-w-0 truncate">
                        {j.document}
                        <span className="ml-2 text-[12px] text-faint">
                          {j.pages} {j.pages === 1 ? "page" : "pages"} · {j.printer} · {timeAgo(j.created_at)}
                        </span>
                      </span>
                      <Badge tone={JOB_TONE[j.status] ?? "neutral"} dot>
                        {j.status[0].toUpperCase() + j.status.slice(1)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[14px] text-muted">No print jobs.</p>
              )}
            </Card>
          </div>
        )
      )}
    </div>
  );
}

interface MfaState {
  enabled: boolean;
  pending: { secret: string; expires: string; qr: string } | null;
}

export function MfaSetup() {
  const toast = useToast();
  const { data, loading, setData } = useApi<MfaState>("/api/mfa");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (json: Record<string, string>, ok?: string) => {
    setBusy(true);
    setError(null);
    try {
      const d = await api<MfaState>("/api/mfa", { method: "POST", json });
      setData(d);
      setCode("");
      if (ok) toast(ok, "ok");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader title="Authenticator app" sub="A second step at sign-in: your password plus a 6-digit code from your phone." />
      {loading && !data ? (
        <Skeleton className="h-72" />
      ) : (
        data && (
          <Card className="p-6">
            {data.enabled ? (
              <div>
                <Badge tone="ok" dot>
                  Authenticator is on
                </Badge>
                <p className="mt-3 text-[14px] leading-relaxed text-muted">
                  You'll be asked for a code when you sign in with your password. Changed phones? Ask the assistant to reset your MFA, or turn it off here with a current code.
                </p>
                <form
                  className="mt-4 flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    act({ action: "disable", code }, "Authenticator turned off.");
                  }}
                >
                  <Field label="Current code">
                    <input className={inputCls + " w-36 font-mono tracking-[0.3em]"} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
                  </Field>
                  <Button type="submit" variant="secondary" loading={busy}>
                    Turn off
                  </Button>
                </form>
              </div>
            ) : data.pending ? (
              <div>
                <ol className="list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-ink-2">
                  <li>Open Google Authenticator or Microsoft Authenticator on your phone.</li>
                  <li>Add an account and scan this QR code.</li>
                  <li>Enter the 6-digit code it shows.</li>
                </ol>
                <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={data.pending.qr} alt="QR code for your authenticator app" width={180} height={180} className="rounded-xl border border-line bg-white p-2" />
                  <div className="min-w-0 text-[13px] text-muted">
                    <p>Can't scan? Enter this key instead:</p>
                    <p className="mt-1 break-all font-mono text-[13px] text-ink">{data.pending.secret.replace(/(.{4})/g, "$1 ").trim()}</p>
                    <p className="mt-2">Set it up before {new Date(data.pending.expires).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}.</p>
                  </div>
                </div>
                <form
                  className="mt-5 flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    act({ action: "verify", code }, "Authenticator is set up.");
                  }}
                >
                  <Field label="6-digit code">
                    <input className={inputCls + " w-36 font-mono tracking-[0.3em]"} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required autoFocus />
                  </Field>
                  <Button type="submit" loading={busy}>
                    Confirm
                  </Button>
                </form>
              </div>
            ) : (
              <div>
                <p className="text-[14px] leading-relaxed text-muted">No authenticator is set up on your account.</p>
                <Button className="mt-4" onClick={() => act({ action: "start" })} loading={busy} icon={<Smartphone size={15} />}>
                  Set up an authenticator
                </Button>
              </div>
            )}
            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-bad-bg px-3 py-2 text-[13.5px] text-bad">
                {error}
              </p>
            )}
          </Card>
        )
      )}
    </div>
  );
}
