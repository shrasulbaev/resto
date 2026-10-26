import { and, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";
import { env } from "@/lib/env";

// Web Push to installed staff apps. Without VAPID keys push is simply off.

export type PushMessage = { title: string; body?: string; url?: string; tag?: string; urgent?: boolean };
type Target = { endpoint: string; p256dh: string; auth: string };
type Sender = (target: Target, payload: string) => Promise<void>;

let configured = false;
const defaultSender: Sender = async (t, payload) => {
  if (!configured) {
    const e = env();
    webpush.setVapidDetails(e.VAPID_SUBJECT || "mailto:admin@example.com", e.VAPID_PUBLIC_KEY!, e.VAPID_PRIVATE_KEY!);
    configured = true;
  }
  await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, { TTL: 300, urgency: "high" });
};
let sender: Sender = defaultSender;

export function setPushSender(s: Sender | null) {
  sender = s ?? defaultSender;
}

export function pushEnabled() {
  const e = env();
  return sender !== defaultSender || !!(e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY);
}

export async function saveSubscription(
  owner: { venueId: string; staffId?: string | null; userId?: string | null },
  sub: { endpoint: string; p256dh: string; auth: string },
) {
  const values = { venueId: owner.venueId, staffId: owner.staffId ?? null, userId: owner.userId ?? null, ...sub };
  await db().insert(pushSubscriptions).values(values).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
}

export async function removeSubscription(endpoint: string) {
  await db().delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

async function deliver(targets: Target[], msg: PushMessage) {
  if (!pushEnabled() || targets.length === 0) return 0;
  const payload = JSON.stringify(msg);
  let sent = 0;
  await Promise.all(
    targets.map(async (t) => {
      try {
        await sender(t, payload);
        sent++;
      } catch (e) {
        // The browser dropped the subscription: forget it.
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await removeSubscription(t.endpoint);
        else console.error("push failed", code ?? e);
      }
    }),
  );
  return sent;
}

export async function pushToStaff(venueId: string, staffIds: string[], msg: PushMessage) {
  if (staffIds.length === 0) return 0;
  const targets = await db()
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.venueId, venueId), inArray(pushSubscriptions.staffId, staffIds)));
  return deliver(targets, msg);
}

export async function pushToUsers(venueId: string, userIds: string[], msg: PushMessage) {
  if (userIds.length === 0) return 0;
  const targets = await db()
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.venueId, venueId), inArray(pushSubscriptions.userId, userIds)));
  return deliver(targets, msg);
}
