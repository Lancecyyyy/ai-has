import { one } from "@/lib/server/db";
import { requireUser, handle, HttpError } from "@/lib/server/auth";
import { vpnConfig } from "@/lib/server/workflows";

type Ctx = { params: Promise<{ id: string }> };

/** Download your own, still-valid VPN profile. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const p = await one<{ serial: string; private_key: string; address: string; expires_at: string; revoked_at: string | null }>(
    "select serial, private_key, address, expires_at, revoked_at from vpn_profiles where id = $1 and user_id = $2",
    [Number(id), user.id],
  );
  if (!p) throw new HttpError(404, "VPN profile not found.");
  if (p.revoked_at) throw new HttpError(410, "This VPN profile was revoked. Download the newest one from My IT.");
  return new Response(vpnConfig(p), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="meridian-${p.serial.toLowerCase()}.conf"`,
      "cache-control": "no-store",
    },
  });
});
