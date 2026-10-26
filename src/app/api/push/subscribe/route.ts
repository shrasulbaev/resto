import { NextResponse } from "next/server";
import { z } from "zod";
import { removeSubscription, saveSubscription } from "@/server/push";
import { getSession } from "@/server/session";

const body = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export async function POST(req: Request) {
  const s = await getSession();
  const owner =
    s?.kind === "staff" ? { venueId: s.venueId, staffId: s.staffId }
    : s?.kind === "user" && s.venueId ? { venueId: s.venueId, userId: s.userId }
    : null;
  if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  await saveSubscription(owner, { endpoint: p.data.endpoint, p256dh: p.data.keys.p256dh, auth: p.data.keys.auth });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const p = z.object({ endpoint: z.string().url() }).safeParse(await req.json().catch(() => null));
  if (p.success) await removeSubscription(p.data.endpoint);
  return NextResponse.json({ ok: true });
}
