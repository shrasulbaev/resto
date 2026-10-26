import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { calls, staff, tableVisits, tables, venues, type Table, type Venue } from "@/db/schema";
import { acceptCall, closeVisit, completeCall, guestCall, guestState, isVenueOpen, openTableByStaff, sweepVenue } from "@/server/tables";
import { freshDemo } from "./helpers";

let venue: Venue;
let table: Table;
let waiterId: string;
const T0 = new Date("2026-10-26T12:00:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000);

async function reloadVenue() {
  [venue] = await db().select().from(venues).where(eq(venues.id, venue.id));
}

describe("table states and calls", () => {
  beforeEach(async () => {
    venue = await freshDemo();
    [table] = await db().select().from(tables).where(eq(tables.number, 5));
    [{ id: waiterId }] = await db().select().from(staff).where(eq(staff.name, "Айбек"));
  });

  it("starts closed with only the waiter call available", async () => {
    const s = await guestState(table.token, null, T0);
    expect(s).toMatchObject({ table: "closed", mine: false, attempts: 0 });
    const bill = await guestCall(table.token, { type: "bill" }, T0);
    expect(bill).toMatchObject({ ok: false, error: "not_open" });
  });

  it("first call makes the table pending and gives the phone a key", async () => {
    const r = await guestCall(table.token, { type: "waiter" }, T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state).toMatchObject({ table: "pending", mine: true, attempts: 1 });
    expect(r.state.key).toBeTruthy();
    expect(r.state.nextCallAt).toBe(at(5).toISOString());
    const [t] = await db().select().from(tables).where(eq(tables.id, table.id));
    expect(t.status).toBe("pending");
  });

  it("allows 3 calls 5 minutes apart, then refuses", async () => {
    const r1 = await guestCall(table.token, { type: "waiter" }, T0);
    const key = r1.ok ? r1.state.key : null;
    expect(await guestCall(table.token, { key, type: "waiter" }, at(2))).toMatchObject({ ok: false, error: "too_soon" });
    expect((await guestCall(table.token, { key, type: "waiter" }, at(5))).ok).toBe(true);
    expect((await guestCall(table.token, { key, type: "waiter" }, at(10))).ok).toBe(true);
    expect(await guestCall(table.token, { key, type: "waiter" }, at(14))).toMatchObject({ ok: false, error: "limit" });
  });

  it("closes the table when nobody reacts to 3 calls and reports it", async () => {
    const r1 = await guestCall(table.token, { type: "waiter" }, T0);
    const key = r1.ok ? r1.state.key : null;
    await guestCall(table.token, { key, type: "waiter" }, at(5));
    await guestCall(table.token, { key, type: "waiter" }, at(10));
    const { unanswered } = await sweepVenue(venue, at(15));
    expect(unanswered).toHaveLength(1);
    const s = await guestState(table.token, key, at(15));
    expect(s).toMatchObject({ table: "closed", mine: false, key: null });
    const [v] = await db().select().from(tableVisits);
    expect(v).toMatchObject({ status: "closed", closeReason: "no_response" });
    // A fresh scan can start over.
    expect((await guestCall(table.token, { type: "waiter" }, at(16))).ok).toBe(true);
  });

  it("uses the admin's pause setting", async () => {
    await db().update(venues).set({ callPauseSec: 60 }).where(eq(venues.id, venue.id));
    const r1 = await guestCall(table.token, { type: "waiter" }, T0);
    const key = r1.ok ? r1.state.key : null;
    expect((await guestCall(table.token, { key, type: "waiter" }, at(1))).ok).toBe(true);
  });

  it("opens the table when a waiter accepts, unlocking bill and container", async () => {
    const r1 = await guestCall(table.token, { type: "waiter" }, T0);
    const key = r1.ok ? r1.state.key : null;
    const [call] = await db().select().from(calls);
    await acceptCall(venue.id, waiterId, call.id, at(1));
    const s = await guestState(table.token, key, at(1));
    expect(s).toMatchObject({ table: "open", mine: true, waiterName: "Айбек" });
    expect((await guestCall(table.token, { key, type: "bill", payload: { payment: "card" } }, at(2))).ok).toBe(true);
    expect((await guestCall(table.token, { key, type: "container" }, at(2))).ok).toBe(true);
    // Same request again right away is ignored.
    expect(await guestCall(table.token, { key, type: "bill" }, at(2))).toMatchObject({ ok: false, error: "too_soon" });
  });

  it("closing the bill takes buttons away from every phone", async () => {
    const r1 = await guestCall(table.token, { type: "waiter" }, T0);
    const key = r1.ok ? r1.state.key : null;
    const [call] = await db().select().from(calls);
    await acceptCall(venue.id, waiterId, call.id, at(1));
    const [visit] = await db().select().from(tableVisits);
    await closeVisit(visit, "paid", at(30));
    expect(await guestState(table.token, key, at(31))).toMatchObject({ table: "closed", mine: false });
    expect(await guestCall(table.token, { key, type: "bill" }, at(31))).toMatchObject({ ok: false, error: "not_open" });
  });

  it("auto-closes an idle open table after the configured hours", async () => {
    const r1 = await guestCall(table.token, { type: "waiter" }, T0);
    const [call] = await db().select().from(calls);
    await acceptCall(venue.id, waiterId, call.id, at(1));
    await sweepVenue(venue, at(60 * 3));
    expect((await guestState(table.token, r1.ok ? r1.state.key : null, at(60 * 3)))?.table).toBe("open");
    await sweepVenue(venue, at(60 * 4 + 2));
    expect((await guestState(table.token, null, at(60 * 4 + 2)))?.table).toBe("closed");
  });

  it("refuses calls outside working hours", async () => {
    await db().update(venues).set({ opensAt: "10:00", closesAt: "22:00" }).where(eq(venues.id, venue.id));
    // 12:00Z is 18:00 in Bishkek (UTC+6): open. 17:00Z is 23:00: closed.
    expect((await guestCall(table.token, { type: "waiter" }, T0)).ok).toBe(true);
    const other = (await db().select().from(tables).where(eq(tables.number, 6)))[0];
    expect(await guestCall(other.token, { type: "waiter" }, new Date("2026-10-26T17:00:00Z"))).toMatchObject({ ok: false, error: "hours" });
  });

  it("handles overnight working hours", () => {
    const v = { opensAt: "18:00", closesAt: "02:00", timezone: "Asia/Bishkek" };
    expect(isVenueOpen(v, new Date("2026-10-26T19:00:00Z"))).toBe(true); // 01:00 local
    expect(isVenueOpen(v, new Date("2026-10-26T06:00:00Z"))).toBe(false); // 12:00 local
  });

  it("does not let staff of another venue accept a call", async () => {
    await guestCall(table.token, { type: "waiter" }, T0);
    const [call] = await db().select().from(calls);
    const [other] = await db().insert(venues).values({ slug: "x", name: "X" }).returning();
    expect(await acceptCall(other.id, waiterId, call.id, at(1))).toBeNull();
    expect(await completeCall(other.id, waiterId, call.id, at(1))).toBeNull();
  });

  it("lets a waiter open a table without a guest call", async () => {
    const visit = await openTableByStaff(venue.id, waiterId, table.id, T0);
    expect(visit?.status).toBe("open");
    const s = await guestState(table.token, visit!.guestKey, T0);
    expect(s?.table).toBe("open");
    await reloadVenue();
  });
});
