import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { calls, pushSubscriptions, staff, tables, users, venues, waiterTables, type Venue } from "@/db/schema";
import { handleEvent } from "@/server/notify";
import { addItems, markItemReady, sendToKitchen } from "@/server/orders";
import { saveSubscription, setPushSender } from "@/server/push";
import { guestCall, openTableByStaff, sweepVenue } from "@/server/tables";
import { freshDemo } from "./helpers";

let venue: Venue;
let aibek: string;
let nurlan: string;
let sent: { endpoint: string; msg: { title: string; body?: string } }[] = [];

describe("push notifications", () => {
  beforeEach(async () => {
    venue = await freshDemo();
    [{ id: aibek }] = await db().select().from(staff).where(eq(staff.name, "Айбек"));
    [{ id: nurlan }] = await db().select().from(staff).where(eq(staff.name, "Нурлан"));
    await saveSubscription({ venueId: venue.id, staffId: aibek }, { endpoint: "https://push/a", p256dh: "k", auth: "a" });
    await saveSubscription({ venueId: venue.id, staffId: nurlan }, { endpoint: "https://push/n", p256dh: "k", auth: "a" });
    sent = [];
    setPushSender(async (t, payload) => {
      if (t.endpoint === "https://push/gone") throw Object.assign(new Error("gone"), { statusCode: 410 });
      sent.push({ endpoint: t.endpoint, msg: JSON.parse(payload) });
    });
  });
  afterAll(() => setPushSender(null));

  const lastCall = async () => (await db().select().from(calls).orderBy(calls.createdAt)).at(-1)!;

  it("tells every waiter about a call in 'any' mode", async () => {
    const [t] = await db().select().from(tables).where(eq(tables.number, 5));
    await guestCall(t.token, { type: "waiter" });
    const c = await lastCall();
    await handleEvent({ venueId: venue.id, type: "call", callId: c.id, tableId: t.id });
    expect(sent.map((s) => s.endpoint).sort()).toEqual(["https://push/a", "https://push/n"]);
    expect(sent[0].msg.title).toBe("Стол 5 · Зовут официанта");
  });

  it("tells only the assigned waiter, then everyone after escalation", async () => {
    await db().update(venues).set({ assignmentMode: "assigned" }).where(eq(venues.id, venue.id));
    const [t] = await db().select().from(tables).where(eq(tables.number, 5));
    await db().insert(waiterTables).values({ staffId: aibek, tableId: t.id });
    const t0 = new Date();
    await guestCall(t.token, { type: "waiter" }, t0);
    const c = await lastCall();
    await handleEvent({ venueId: venue.id, type: "call", callId: c.id, tableId: t.id });
    expect(sent.map((s) => s.endpoint)).toEqual(["https://push/a"]);

    sent = [];
    const [v] = await db().select().from(venues).where(eq(venues.id, venue.id));
    await sweepVenue(v, new Date(t0.getTime() + 121_000));
    const [esc] = await db().select().from(calls).where(eq(calls.id, c.id));
    expect(esc.escalated).toBe(true);
    await handleEvent({ venueId: venue.id, type: "call", callId: c.id, tableId: t.id, escalated: true });
    expect(sent.map((s) => s.endpoint).sort()).toEqual(["https://push/a", "https://push/n"]);
  });

  it("tells the table's waiter when a dish is ready", async () => {
    const [t] = await db().select().from(tables).where(eq(tables.number, 2));
    const v = (await openTableByStaff(venue.id, nurlan, t.id))!;
    const { dishes } = await import("@/db/schema");
    const [plov] = await db().select().from(dishes).where(eq(dishes.nameRu, "Плов"));
    await addItems(venue.id, nurlan, v.id, [{ dishId: plov.id, qty: 2 }]);
    await sendToKitchen(venue.id, v.id);
    const { orderItems } = await import("@/db/schema");
    const [item] = await db().select().from(orderItems);
    await markItemReady(venue.id, item.id);
    await handleEvent({ venueId: venue.id, type: "item_ready", orderId: item.orderId, tableId: t.id, itemId: item.id });
    expect(sent).toEqual([{ endpoint: "https://push/n", msg: expect.objectContaining({ title: "Стол 2 · готово", body: "2 × Плов" }) }]);
  });

  it("alerts the owner and drops dead subscriptions", async () => {
    const [owner] = await db().select().from(users).where(eq(users.email, "admin@demo.kg"));
    await saveSubscription({ venueId: venue.id, userId: owner.id }, { endpoint: "https://push/gone", p256dh: "k", auth: "a" });
    const [t] = await db().select().from(tables).where(eq(tables.number, 1));
    await handleEvent({ venueId: venue.id, type: "alert", kind: "no_response", tableId: t.id });
    const left = await db().select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, "https://push/gone"));
    expect(left).toHaveLength(0);
  });

  it("ignores calls that were already accepted", async () => {
    const [t] = await db().select().from(tables).where(eq(tables.number, 5));
    await guestCall(t.token, { type: "waiter" });
    const c = await lastCall();
    await db().update(calls).set({ status: "accepted" }).where(eq(calls.id, c.id));
    await handleEvent({ venueId: venue.id, type: "call", callId: c.id, tableId: t.id });
    expect(sent).toEqual([]);
  });
});
