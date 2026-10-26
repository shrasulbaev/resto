import { and, asc, eq, inArray, lte, ne } from "drizzle-orm";
import { db } from "@/db/client";
import {
  calls,
  staff,
  tableVisits,
  tables,
  venues,
  type Call,
  type CallPayload,
  type TableVisit,
  type Venue,
} from "@/db/schema";
import { randomToken } from "@/lib/tokens";
import { publish } from "./events";
import { findTableByToken } from "./menu";

/*
 Table lifecycle (agreed with the owner):
   closed  -> guest presses "call waiter"            -> pending
   pending -> up to maxPendingCalls calls, callPauseSec apart
   pending -> a waiter accepts                       -> open
   pending -> nobody reacts to the last allowed call -> closed (admin is alerted)
   open    -> waiter closes the bill                 -> closed
   open    -> no activity for autoCloseHours         -> closed
 Only phones holding the visit's guest key get bill/container/other buttons;
 the key stops working when the visit closes.
*/

export type CallType = Call["type"];
export type GuestError = "not_found" | "hours" | "too_soon" | "limit" | "not_open";

export type GuestState = {
  venueOpen: boolean;
  table: "closed" | "pending" | "open";
  mine: boolean;
  key: string | null;
  attempts: number;
  maxAttempts: number;
  nextCallAt: string | null;
  waiterName: string | null;
  activeCalls: { type: CallType; status: Call["status"] }[];
};

const ACTIVE_VISIT = inArray(tableVisits.status, ["pending", "open"]);
// At an open table the same request can be repeated after this pause.
const OPEN_REPEAT_SEC = 60;

function localMinutes(tz: string, now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value);
  return h * 60 + m;
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isVenueOpen(venue: Pick<Venue, "opensAt" | "closesAt" | "timezone">, now = new Date()) {
  if (!venue.opensAt || !venue.closesAt) return true;
  const cur = localMinutes(venue.timezone, now);
  const open = toMinutes(venue.opensAt);
  const close = toMinutes(venue.closesAt);
  if (open === close) return true;
  // Overnight hours, e.g. 18:00–02:00.
  return open < close ? cur >= open && cur < close : cur >= open || cur < close;
}

async function activeVisit(tableId: string) {
  const [v] = await db().select().from(tableVisits).where(and(eq(tableVisits.tableId, tableId), ACTIVE_VISIT));
  return v ?? null;
}

async function visitCalls(visitId: string) {
  return db().select().from(calls).where(eq(calls.visitId, visitId)).orderBy(asc(calls.createdAt));
}

async function setTableStatus(tableId: string, status: "closed" | "pending" | "open") {
  await db().update(tables).set({ status }).where(eq(tables.id, tableId));
}

export async function closeVisit(visit: TableVisit, reason: NonNullable<TableVisit["closeReason"]>, now = new Date()) {
  await db()
    .update(tableVisits)
    .set({ status: "closed", closeReason: reason, closedAt: now })
    .where(and(eq(tableVisits.id, visit.id), ne(tableVisits.status, "closed")));
  await db()
    .update(calls)
    .set({ status: "expired" })
    .where(and(eq(calls.visitId, visit.id), inArray(calls.status, ["new", "accepted"])));
  await setTableStatus(visit.tableId, "closed");
  await publish(visit.venueId, { type: "table", tableId: visit.tableId });
}

// Closes pending tables nobody answered and open tables left idle.
// Returns visits closed for lack of response so the admin can be alerted.
export async function sweepVenue(venue: Venue, now = new Date()) {
  const unanswered: TableVisit[] = [];
  const pendingDeadline = new Date(now.getTime() - venue.maxPendingCalls * venue.callPauseSec * 1000);
  const pending = await db()
    .select()
    .from(tableVisits)
    .where(and(eq(tableVisits.venueId, venue.id), eq(tableVisits.status, "pending"), lte(tableVisits.openedAt, pendingDeadline)));
  for (const v of pending) {
    await closeVisit(v, "no_response", now);
    await publish(venue.id, { type: "alert", kind: "no_response", tableId: v.tableId });
    unanswered.push(v);
  }
  const idleDeadline = new Date(now.getTime() - venue.autoCloseHours * 3600 * 1000);
  const idle = await db()
    .select()
    .from(tableVisits)
    .where(and(eq(tableVisits.venueId, venue.id), eq(tableVisits.status, "open"), lte(tableVisits.lastActivityAt, idleDeadline)));
  for (const v of idle) await closeVisit(v, "timeout", now);
  return { unanswered };
}

// Background sweep for every venue that has a pending or open table.
export async function sweepAll(now = new Date()) {
  const rows = await db().selectDistinct({ venue: venues }).from(tableVisits).innerJoin(venues, eq(venues.id, tableVisits.venueId)).where(ACTIVE_VISIT);
  for (const { venue } of rows) await sweepVenue(venue, now);
}

async function buildState(venue: Venue, tableId: string, key: string | null, now: Date): Promise<GuestState> {
  const visit = await activeVisit(tableId);
  const base: GuestState = {
    venueOpen: isVenueOpen(venue, now),
    table: "closed",
    mine: false,
    key: null,
    attempts: 0,
    maxAttempts: venue.maxPendingCalls,
    nextCallAt: null,
    waiterName: null,
    activeCalls: [],
  };
  if (!visit) return base;
  const list = await visitCalls(visit.id);
  const attempts = list.filter((c) => c.type === "waiter").length;
  const last = list.at(-1);
  let waiterName: string | null = null;
  if (visit.waiterId) {
    const [w] = await db().select({ name: staff.name }).from(staff).where(eq(staff.id, visit.waiterId));
    waiterName = w?.name ?? null;
  }
  // Phones at an open table join freely; while pending only the caller's phone holds the key.
  const mine = visit.status === "open" || (!!key && key === visit.guestKey);
  return {
    ...base,
    table: visit.status === "open" ? "open" : "pending",
    mine,
    key: mine ? visit.guestKey : null,
    attempts,
    nextCallAt:
      visit.status === "pending" && last && attempts < venue.maxPendingCalls
        ? new Date(last.createdAt.getTime() + venue.callPauseSec * 1000).toISOString()
        : null,
    waiterName,
    activeCalls: list.filter((c) => c.status === "new" || c.status === "accepted").map((c) => ({ type: c.type, status: c.status })),
  };
}

export async function guestState(token: string, key: string | null, now = new Date()) {
  const found = await findTableByToken(token);
  if (!found) return null;
  await sweepVenue(found.venue, now);
  return buildState(found.venue, found.table.id, key, now);
}

export type CallInput = { key?: string | null; type: CallType; payload?: CallPayload };

export async function guestCall(
  token: string,
  input: CallInput,
  now = new Date(),
): Promise<{ ok: true; state: GuestState } | { ok: false; error: GuestError; state?: GuestState }> {
  const found = await findTableByToken(token);
  if (!found) return { ok: false, error: "not_found" };
  const { venue, table } = found;
  await sweepVenue(venue, now);
  if (!isVenueOpen(venue, now)) return { ok: false, error: "hours", state: await buildState(venue, table.id, input.key ?? null, now) };

  const payload = input.payload ?? {};
  let visit = await activeVisit(table.id);

  if (!visit) {
    if (input.type !== "waiter") return { ok: false, error: "not_open", state: await buildState(venue, table.id, null, now) };
    const [created] = await db()
      .insert(tableVisits)
      .values({ venueId: venue.id, tableId: table.id, guestKey: randomToken(), status: "pending", openedAt: now, lastActivityAt: now })
      .returning();
    visit = created;
    await setTableStatus(table.id, "pending");
    await insertCall(visit, "waiter", payload, 1, now);
    return { ok: true, state: await buildState(venue, table.id, visit.guestKey, now) };
  }

  // Another phone at the same table joins the visit.
  const key = visit.guestKey;
  const list = await visitCalls(visit.id);

  if (visit.status === "pending") {
    if (input.type !== "waiter") return { ok: false, error: "not_open", state: await buildState(venue, table.id, key, now) };
    const attempts = list.filter((c) => c.type === "waiter").length;
    if (attempts >= venue.maxPendingCalls) return { ok: false, error: "limit", state: await buildState(venue, table.id, key, now) };
    const last = list.at(-1);
    if (last && now.getTime() - last.createdAt.getTime() < venue.callPauseSec * 1000) {
      return { ok: false, error: "too_soon", state: await buildState(venue, table.id, key, now) };
    }
    await insertCall(visit, "waiter", payload, attempts + 1, now);
    return { ok: true, state: await buildState(venue, table.id, key, now) };
  }

  // Open table: one pending request per type, repeatable after a short pause.
  const sameType = list.filter((c) => c.type === input.type).at(-1);
  if (sameType?.status === "new" || (sameType && now.getTime() - sameType.createdAt.getTime() < OPEN_REPEAT_SEC * 1000)) {
    return { ok: false, error: "too_soon", state: await buildState(venue, table.id, key, now) };
  }
  await insertCall(visit, input.type, payload, 1, now);
  await db().update(tableVisits).set({ lastActivityAt: now }).where(eq(tableVisits.id, visit.id));
  return { ok: true, state: await buildState(venue, table.id, key, now) };
}

async function insertCall(visit: TableVisit, type: CallType, payload: CallPayload, attempt: number, now: Date) {
  const [call] = await db()
    .insert(calls)
    .values({ venueId: visit.venueId, tableId: visit.tableId, visitId: visit.id, type, payload, attempt, createdAt: now })
    .returning();
  await publish(visit.venueId, { type: "call", callId: call.id, tableId: visit.tableId });
  return call;
}

// Staff actions. venueId always comes from the staff session.

export async function acceptCall(venueId: string, staffId: string, callId: string, now = new Date()) {
  const [call] = await db().select().from(calls).where(and(eq(calls.id, callId), eq(calls.venueId, venueId)));
  if (!call || call.status !== "new") return null;
  await db().update(calls).set({ status: "accepted", acceptedBy: staffId, acceptedAt: now }).where(eq(calls.id, call.id));
  const [visit] = await db().select().from(tableVisits).where(eq(tableVisits.id, call.visitId));
  if (visit && visit.status !== "closed") {
    await db()
      .update(tableVisits)
      .set({
        status: "open",
        acceptedAt: visit.acceptedAt ?? now,
        waiterId: visit.waiterId ?? staffId,
        lastActivityAt: now,
      })
      .where(eq(tableVisits.id, visit.id));
    // Earlier unanswered calls of the same pending visit are covered by this one.
    if (visit.status === "pending") {
      await db()
        .update(calls)
        .set({ status: "accepted", acceptedBy: staffId, acceptedAt: now })
        .where(and(eq(calls.visitId, visit.id), eq(calls.status, "new"), eq(calls.type, "waiter")));
    }
    await setTableStatus(visit.tableId, "open");
  }
  await publish(venueId, { type: "call", callId: call.id, tableId: call.tableId });
  return call;
}

export async function completeCall(venueId: string, staffId: string, callId: string, now = new Date()) {
  const [call] = await db().select().from(calls).where(and(eq(calls.id, callId), eq(calls.venueId, venueId)));
  if (!call || call.status === "done" || call.status === "expired") return null;
  if (call.status === "new") await acceptCall(venueId, staffId, callId, now);
  await db().update(calls).set({ status: "done", doneAt: now }).where(eq(calls.id, call.id));
  await publish(venueId, { type: "call", callId: call.id, tableId: call.tableId });
  return call;
}

export async function touchVisit(visitId: string, now = new Date()) {
  await db().update(tableVisits).set({ lastActivityAt: now }).where(eq(tableVisits.id, visitId));
}

// Staff open a table themselves (e.g. a guest who did not scan the QR).
export async function openTableByStaff(venueId: string, staffId: string, tableId: string, now = new Date()) {
  const [table] = await db().select().from(tables).where(and(eq(tables.id, tableId), eq(tables.venueId, venueId)));
  if (!table) return null;
  const existing = await activeVisit(table.id);
  if (existing) {
    if (existing.status === "pending") {
      await db()
        .update(tableVisits)
        .set({ status: "open", acceptedAt: now, waiterId: existing.waiterId ?? staffId, lastActivityAt: now })
        .where(eq(tableVisits.id, existing.id));
      await db()
        .update(calls)
        .set({ status: "accepted", acceptedBy: staffId, acceptedAt: now })
        .where(and(eq(calls.visitId, existing.id), eq(calls.status, "new")));
      await setTableStatus(table.id, "open");
      await publish(venueId, { type: "table", tableId: table.id });
    }
    return (await activeVisit(table.id))!;
  }
  const [visit] = await db()
    .insert(tableVisits)
    .values({ venueId, tableId: table.id, guestKey: randomToken(), status: "open", waiterId: staffId, openedAt: now, acceptedAt: now, lastActivityAt: now })
    .returning();
  await setTableStatus(table.id, "open");
  await publish(venueId, { type: "table", tableId: table.id });
  return visit;
}

export async function venueVisitById(venueId: string, visitId: string) {
  const [v] = await db().select().from(tableVisits).where(and(eq(tableVisits.id, visitId), eq(tableVisits.venueId, venueId)));
  return v ?? null;
}
