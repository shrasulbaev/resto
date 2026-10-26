import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { staff, tables, venues, waiterTables, type Venue } from "@/db/schema";
import { authenticateStaff } from "@/server/auth";
import {
  addTables, adminTables, createStaff, deleteTable, qrSvg, reissueQr, renumberTable, saveSettings, setWaiterTables, updateStaff,
} from "@/server/admin-venue";
import { findTableByToken } from "@/server/menu";
import { guestCall, guestState } from "@/server/tables";
import { freshDemo } from "./helpers";

let venue: Venue;
let other: Venue;

describe("admin tables, staff, settings", () => {
  beforeEach(async () => {
    venue = await freshDemo();
    [other] = await db().insert(venues).values({ slug: "other", name: "Other" }).returning();
  });

  it("adds tables after the highest number with unique QR tokens", async () => {
    expect(await addTables(venue.id, 3)).toBe(3);
    const list = await adminTables(venue.id);
    expect(list.map((t) => t.number).slice(-3)).toEqual([11, 12, 13]);
    expect(new Set(list.map((t) => t.token)).size).toBe(list.length);
    expect(await qrSvg(list[0].token)).toContain("<svg");
  });

  it("reissuing a QR kills the old link and closes the table", async () => {
    const [t] = await db().select().from(tables).where(eq(tables.number, 5));
    await guestCall(t.token, { type: "waiter" });
    const fresh = (await reissueQr(venue.id, t.id))!;
    expect(fresh.token).not.toBe(t.token);
    expect(await findTableByToken(t.token)).toBeNull();
    expect((await guestState(fresh.token, null))?.table).toBe("closed");
    expect(await reissueQr(other.id, t.id)).toBeNull();
  });

  it("renumbers without clashes and deletes only free tables", async () => {
    const [t5] = await db().select().from(tables).where(eq(tables.number, 5));
    expect(await renumberTable(venue.id, t5.id, 6)).toBe(false);
    expect(await renumberTable(venue.id, t5.id, 50)).toBe(true);
    await guestCall(t5.token, { type: "waiter" });
    expect(await deleteTable(venue.id, t5.id)).toBe(false);
    const [t6] = await db().select().from(tables).where(eq(tables.number, 6));
    expect(await deleteTable(other.id, t6.id)).toBe(false);
    expect(await deleteTable(venue.id, t6.id)).toBe(true);
  });

  it("creates staff with a PIN that works for login and can be deactivated", async () => {
    expect(await createStaff(venue.id, { name: "Айгуль", role: "waiter", pin: "12" })).toBeNull();
    const s = (await createStaff(venue.id, { name: "Айгуль", role: "waiter", pin: "4321" }))!;
    expect(await authenticateStaff("ala-too", s.id, "4321")).not.toBeNull();
    await updateStaff(venue.id, s.id, { pin: "5555" });
    expect(await authenticateStaff("ala-too", s.id, "4321")).toBeNull();
    await updateStaff(venue.id, s.id, { active: false });
    expect(await authenticateStaff("ala-too", s.id, "5555")).toBeNull();
    expect(await updateStaff(other.id, s.id, { active: true })).toBe(false);
  });

  it("assigns tables only of the same venue", async () => {
    const [aibek] = await db().select().from(staff).where(eq(staff.name, "Айбек"));
    const [foreignTable] = await db().insert(tables).values({ venueId: other.id, number: 1, token: "zzz" }).returning();
    const own = (await adminTables(venue.id)).slice(0, 2).map((t) => t.id);
    expect(await setWaiterTables(venue.id, aibek.id, [...own, foreignTable.id])).toBe(true);
    const links = await db().select().from(waiterTables);
    expect(links.map((l) => l.tableId).sort()).toEqual([...own].sort());
    const [kitchen] = await db().select().from(staff).where(eq(staff.name, "Кухня"));
    expect(await setWaiterTables(venue.id, kitchen.id, own)).toBe(false);
  });

  it("saves call rules and working hours", async () => {
    const r = await saveSettings(venue.id, {
      allDay: false, opensAt: "10:00", closesAt: "23:30", callPauseMin: "3", maxPendingCalls: 4, autoCloseHours: 5, assignmentMode: "assigned", escalateAfterMin: 2,
    });
    expect(r.ok).toBe(true);
    const [v] = await db().select().from(venues).where(eq(venues.id, venue.id));
    expect(v).toMatchObject({ opensAt: "10:00", closesAt: "23:30", callPauseSec: 180, maxPendingCalls: 4, assignmentMode: "assigned", escalateAfterSec: 120 });
    expect((await saveSettings(venue.id, { allDay: false, opensAt: "25:00", closesAt: "1", callPauseMin: 3, maxPendingCalls: 3, autoCloseHours: 4, assignmentMode: "any", escalateAfterMin: 2 })).ok).toBe(false);
    await saveSettings(venue.id, { allDay: true, callPauseMin: 5, maxPendingCalls: 3, autoCloseHours: 4, assignmentMode: "any", escalateAfterMin: 2 });
    const [v2] = await db().select().from(venues).where(eq(venues.id, venue.id));
    expect(v2.opensAt).toBeNull();
  });
});
