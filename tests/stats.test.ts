import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { dishes, staff, tables, venues, type Venue } from "@/db/schema";
import { recordInterest } from "@/server/menu";
import { addItems, closeBill, sendToKitchen } from "@/server/orders";
import { venueStats } from "@/server/stats";
import { acceptCall, guestCall, openTableByStaff } from "@/server/tables";
import { freshDemo } from "./helpers";

let venue: Venue;
let aibek: string;

async function dishId(name: string) {
  const [d] = await db().select().from(dishes).where(and(eq(dishes.venueId, venue.id), eq(dishes.nameRu, name)));
  return d.id;
}

async function bill(number: number, items: [string, number][], payment: "cash" | "card", at: Date) {
  const [t] = await db().select().from(tables).where(eq(tables.number, number));
  const v = (await openTableByStaff(venue.id, aibek, t.id, at))!;
  await addItems(venue.id, aibek, v.id, await Promise.all(items.map(async ([n, qty]) => ({ dishId: await dishId(n), qty }))), { now: at });
  await sendToKitchen(venue.id, v.id, at);
  await closeBill(venue.id, aibek, v.id, payment, new Date(at.getTime() + 30 * 60_000));
}

describe("stats", () => {
  beforeEach(async () => {
    venue = await freshDemo();
    [{ id: aibek }] = await db().select().from(staff).where(eq(staff.name, "Айбек"));
  });

  it("sums closed bills, splits payments and ranks dishes for the period", async () => {
    const now = new Date("2026-10-26T14:00:00Z"); // 20:00 in Bishkek
    await bill(1, [["Плов", 2], ["Чай чёрный", 1]], "cash", new Date("2026-10-26T06:00:00Z")); // 12:00 local
    await bill(2, [["Плов", 1]], "card", new Date("2026-10-26T08:00:00Z"));
    await bill(3, [["Лагман", 1]], "card", new Date("2026-10-20T08:00:00Z")); // 6 days ago

    const today = await venueStats(venue.id, venue.timezone, "today", now);
    expect(today).toMatchObject({ checks: 2, revenue: 450 * 3 + 165, cash: 1065, card: 450 });
    expect(today.avgCheck).toBe(Math.round(1515 / 2));
    expect(today.topDishes[0]).toMatchObject({ name: "Плов", qty: 3 });
    expect(today.hourly[12]).toBe(1);
    expect(today.waiters).toEqual([{ name: "Айбек", checks: 2, revenue: 1515 }]);
    expect(today.bills).toHaveLength(2);

    const week = await venueStats(venue.id, venue.timezone, "7d", now);
    expect(week.checks).toBe(3);
  });

  it("measures reaction time, no-response tables and interest vs orders", async () => {
    const [t] = await db().select().from(tables).where(eq(tables.number, 4));
    const start = new Date(Date.now() - 10 * 60_000);
    const r = await guestCall(t.token, { type: "waiter" }, start);
    expect(r.ok).toBe(true);
    const { calls } = await import("@/db/schema");
    const [c] = await db().select().from(calls);
    await acceptCall(venue.id, aibek, c.id, new Date(start.getTime() + 90_000));
    const plov = await dishId("Плов");
    await recordInterest(t.token, plov);
    await recordInterest(t.token, plov);
    const s = await venueStats(venue.id, venue.timezone, "today");
    expect(s.reactionSec).toBe(90);
    expect(s.interest[0]).toMatchObject({ name: "Плов", added: 2, ordered: 0 });
  });

  it("does not mix venues", async () => {
    await bill(1, [["Плов", 1]], "cash", new Date(Date.now() - 3600_000));
    const [other] = await db().insert(venues).values({ slug: "o", name: "O" }).returning();
    expect((await venueStats(other.id, other.timezone, "30d")).checks).toBe(0);
  });
});
