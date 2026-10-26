import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { calls, dishes, orderItems, orders, staff, tableVisits, tables, venues, waiterTables, type Table, type Venue } from "@/db/schema";
import {
  addItems, cancelItem, closeBill, importCallSelection, markItemReady, markItemServed, sendToKitchen, setItemQty,
} from "@/server/orders";
import { guestCall, guestState, openTableByStaff } from "@/server/tables";
import { acceptCallAsWaiter, completeCallAsWaiter, waiterBoard } from "@/server/waiter";
import { freshDemo } from "./helpers";

let venue: Venue;
let t5: Table;
let aibek: string;
let nurlan: string;
const T0 = new Date("2026-10-26T12:00:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000);

async function dish(name: string) {
  const [d] = await db().select().from(dishes).where(and(eq(dishes.venueId, venue.id), eq(dishes.nameRu, name)));
  return d;
}

describe("waiter", () => {
  beforeEach(async () => {
    venue = await freshDemo();
    [t5] = await db().select().from(tables).where(eq(tables.number, 5));
    [{ id: aibek }] = await db().select().from(staff).where(eq(staff.name, "Айбек"));
    [{ id: nurlan }] = await db().select().from(staff).where(eq(staff.name, "Нурлан"));
  });

  it("shows calls to every waiter in 'any' mode", async () => {
    await guestCall(t5.token, { type: "waiter" }, T0);
    expect((await waiterBoard(venue.id, aibek, at(0.5)))!.calls).toHaveLength(1);
    expect((await waiterBoard(venue.id, nurlan, at(0.5)))!.calls).toHaveLength(1);
  });

  it("routes calls to the assigned waiter and escalates after 2 minutes", async () => {
    await db().update(venues).set({ assignmentMode: "assigned" }).where(eq(venues.id, venue.id));
    await db().insert(waiterTables).values({ staffId: aibek, tableId: t5.id });
    await guestCall(t5.token, { type: "waiter" }, T0);
    expect((await waiterBoard(venue.id, aibek, at(1)))!.calls).toHaveLength(1);
    expect((await waiterBoard(venue.id, nurlan, at(1)))!.calls).toHaveLength(0);
    const [call] = await db().select().from(calls);
    expect(await acceptCallAsWaiter(venue.id, nurlan, call.id, at(1))).toBeNull();
    const late = await waiterBoard(venue.id, nurlan, at(2));
    expect(late!.calls).toMatchObject([{ escalated: true }]);
    expect(await acceptCallAsWaiter(venue.id, nurlan, call.id, at(2))).not.toBeNull();
    const [v] = await db().select().from(tableVisits);
    expect(v).toMatchObject({ status: "open", waiterId: nurlan });
  });

  it("sends later requests of an open table to its waiter first", async () => {
    await db().update(venues).set({ assignmentMode: "assigned" }).where(eq(venues.id, venue.id));
    const visit = await openTableByStaff(venue.id, aibek, t5.id, T0);
    await guestCall(t5.token, { key: visit!.guestKey, type: "bill", payload: { payment: "cash" } }, at(1));
    expect((await waiterBoard(venue.id, nurlan, at(1.5)))!.calls).toHaveLength(0);
    const mine = (await waiterBoard(venue.id, aibek, at(1.5)))!.calls;
    expect(mine).toMatchObject([{ type: "bill", payload: { payment: "cash" } }]);
    expect(await completeCallAsWaiter(venue.id, aibek, mine[0].id, at(2))).not.toBeNull();
    expect((await waiterBoard(venue.id, aibek, at(2)))!.calls).toHaveLength(0);
  });

  it("composes an order, sends it to the kitchen and closes the bill", async () => {
    const visit = (await openTableByStaff(venue.id, aibek, t5.id, T0))!;
    const lagman = await dish("Лагман");
    const water = await dish("Вода 0,5");
    await addItems(venue.id, aibek, visit.id, [{ dishId: lagman.id, qty: 2, comment: "без лука" }], { now: at(1) });
    await addItems(venue.id, aibek, visit.id, [{ dishId: water.id, qty: 1 }], { selfServed: true, now: at(1) });
    const [order] = await db().select().from(orders);
    expect(order.total).toBe(2 * 420 + 140);

    let items = await db().select().from(orderItems);
    const lag = items.find((i) => i.dishId === lagman.id)!;
    expect(lag.sentAt).toBeNull();
    expect(items.find((i) => i.dishId === water.id)).toMatchObject({ status: "served" });
    await setItemQty(venue.id, lag.id, 1);

    expect(await sendToKitchen(venue.id, visit.id, at(2))).toBe(1);
    expect(await setItemQty(venue.id, lag.id, 3)).toBe(false); // already in the kitchen
    expect(await markItemReady(venue.id, lag.id, at(12))).toBe(true);
    expect(await markItemServed(venue.id, lag.id, at(13))).toBe(true);

    // An unsent extra is dropped when the bill closes.
    await addItems(venue.id, aibek, visit.id, [{ dishId: lagman.id, qty: 1 }], { now: at(20) });
    const res = await closeBill(venue.id, aibek, visit.id, "card", at(30));
    expect(res).toMatchObject({ total: 420 + 140 });
    const [closed] = await db().select().from(orders);
    expect(closed).toMatchObject({ status: "closed", payment: "card", total: 560 });
    expect((await guestState(t5.token, visit.guestKey, at(31)))?.table).toBe("closed");
    items = await db().select().from(orderItems);
    expect(items).toHaveLength(2);
  });

  it("cancelling a sent item removes it from the total", async () => {
    const visit = (await openTableByStaff(venue.id, aibek, t5.id, T0))!;
    const plov = await dish("Плов");
    await addItems(venue.id, aibek, visit.id, [{ dishId: plov.id, qty: 1 }]);
    await sendToKitchen(venue.id, visit.id);
    const [item] = await db().select().from(orderItems);
    expect(await cancelItem(venue.id, item.id)).toBe(true);
    const [o] = await db().select().from(orders);
    expect(o.total).toBe(0);
  });

  it("turns the guest's selection into an editable draft", async () => {
    const plov = await dish("Плов");
    const r = await guestCall(t5.token, { type: "waiter", payload: { selection: [{ dishId: plov.id, qty: 2 }] } }, T0);
    const [call] = await db().select().from(calls);
    await acceptCallAsWaiter(venue.id, aibek, call.id, at(1));
    expect(await importCallSelection(venue.id, aibek, call.id, at(2))).not.toBeNull();
    const items = await db().select().from(orderItems);
    expect(items).toMatchObject([{ name: "Плов", qty: 2, sentAt: null }]);
    const [o] = await db().select().from(orders);
    expect(o.source).toBe("guest");
    expect(r.ok).toBe(true);
  });

  it("keeps venues apart", async () => {
    const visit = (await openTableByStaff(venue.id, aibek, t5.id, T0))!;
    const [other] = await db().insert(venues).values({ slug: "other", name: "Other" }).returning();
    const plov = await dish("Плов");
    expect(await addItems(other.id, aibek, visit.id, [{ dishId: plov.id, qty: 1 }])).toBeNull();
    expect(await closeBill(other.id, aibek, visit.id, "cash")).toBeNull();
    expect(await openTableByStaff(other.id, aibek, t5.id)).toBeNull();
  });
});
