import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { calls, orderItems, orders, staff, tableVisits, tables, venues, waiterTables, type Call, type Venue } from "@/db/schema";
import { orderItemsOf, visitOrder } from "./orders";
import { acceptCall, completeCall, sweepVenue } from "./tables";

/*
 Who sees a call:
   mode "any"       -> every waiter.
   mode "assigned"  -> the table's serving waiter, else the waiters assigned
                       to that table (or everyone if none is assigned);
                       after escalateAfterSec it goes to every waiter.
*/

type Ctx = {
  venue: Venue;
  staffId: string;
  assigned: Map<string, Set<string>>; // tableId -> staff ids
  servingBy: Map<string, string | null>; // visitId -> waiter id
  now: Date;
};

export function isEscalated(venue: Venue, call: Pick<Call, "createdAt">, now: Date) {
  return now.getTime() - call.createdAt.getTime() >= venue.escalateAfterSec * 1000;
}

function canSee(ctx: Ctx, call: Call) {
  if (ctx.venue.assignmentMode === "any") return true;
  if (isEscalated(ctx.venue, call, ctx.now)) return true;
  const serving = ctx.servingBy.get(call.visitId);
  if (serving) return serving === ctx.staffId;
  const owners = ctx.assigned.get(call.tableId);
  return !owners || owners.size === 0 || owners.has(ctx.staffId);
}

async function loadCtx(venueId: string, staffId: string, now: Date): Promise<Ctx | null> {
  const [venue] = await db().select().from(venues).where(eq(venues.id, venueId));
  if (!venue) return null;
  const links = await db()
    .select({ staffId: waiterTables.staffId, tableId: waiterTables.tableId })
    .from(waiterTables)
    .innerJoin(tables, eq(tables.id, waiterTables.tableId))
    .where(eq(tables.venueId, venueId));
  const assigned = new Map<string, Set<string>>();
  for (const l of links) {
    if (!assigned.has(l.tableId)) assigned.set(l.tableId, new Set());
    assigned.get(l.tableId)!.add(l.staffId);
  }
  const visits = await db()
    .select({ id: tableVisits.id, waiterId: tableVisits.waiterId })
    .from(tableVisits)
    .where(and(eq(tableVisits.venueId, venueId), inArray(tableVisits.status, ["pending", "open"])));
  return { venue, staffId, assigned, servingBy: new Map(visits.map((v) => [v.id, v.waiterId])), now };
}

export type BoardCall = {
  id: string;
  tableId: string;
  tableNumber: number;
  type: Call["type"];
  status: Call["status"];
  payload: Call["payload"];
  attempt: number;
  createdAt: string;
  escalated: boolean;
};

export type BoardTable = {
  id: string;
  number: number;
  status: "closed" | "pending" | "open";
  visitId: string | null;
  waiterName: string | null;
  mine: boolean;
  assignedToMe: boolean;
  readyCount: number;
  total: number;
};

export async function waiterBoard(venueId: string, staffId: string, now = new Date()) {
  const ctx0 = await loadCtx(venueId, staffId, now);
  if (!ctx0) return null;
  await sweepVenue(ctx0.venue, now);
  const ctx = (await loadCtx(venueId, staffId, now))!;

  const tableRows = await db().select().from(tables).where(eq(tables.venueId, venueId)).orderBy(asc(tables.number));
  const visitRows = await db()
    .select({ visit: tableVisits, waiterName: staff.name })
    .from(tableVisits)
    .leftJoin(staff, eq(staff.id, tableVisits.waiterId))
    .where(and(eq(tableVisits.venueId, venueId), inArray(tableVisits.status, ["pending", "open"])));
  const visitByTable = new Map(visitRows.map((r) => [r.visit.tableId, r]));
  const orderRows = visitRows.length
    ? await db().select().from(orders).where(inArray(orders.visitId, visitRows.map((r) => r.visit.id)))
    : [];
  const readyRows = orderRows.length
    ? await db()
        .select({ orderId: orderItems.orderId })
        .from(orderItems)
        .where(and(inArray(orderItems.orderId, orderRows.map((o) => o.id)), eq(orderItems.status, "ready")))
    : [];

  const boardTables: BoardTable[] = tableRows.map((t) => {
    const v = visitByTable.get(t.id);
    const order = v ? orderRows.find((o) => o.visitId === v.visit.id) : undefined;
    return {
      id: t.id,
      number: t.number,
      status: v ? v.visit.status : "closed",
      visitId: v?.visit.id ?? null,
      waiterName: v?.waiterName ?? null,
      mine: v?.visit.waiterId === staffId,
      assignedToMe: ctx.assigned.get(t.id)?.has(staffId) ?? false,
      readyCount: order ? readyRows.filter((r) => r.orderId === order.id).length : 0,
      total: order?.total ?? 0,
    } as BoardTable;
  });

  const numberOf = new Map(tableRows.map((t) => [t.id, t.number]));
  const newCalls = await db()
    .select()
    .from(calls)
    .where(and(eq(calls.venueId, venueId), eq(calls.status, "new")))
    .orderBy(asc(calls.createdAt));
  const boardCalls: BoardCall[] = newCalls.filter((c) => canSee(ctx, c)).map((c) => ({
    id: c.id,
    tableId: c.tableId,
    tableNumber: numberOf.get(c.tableId) ?? 0,
    type: c.type,
    status: c.status,
    payload: c.payload,
    attempt: c.attempt,
    createdAt: c.createdAt.toISOString(),
    escalated: ctx.venue.assignmentMode === "assigned" && isEscalated(ctx.venue, c, now),
  }));

  return { mode: ctx.venue.assignmentMode, tables: boardTables, calls: boardCalls };
}

// Accepting is refused when the call is not this waiter's to take yet.
export async function acceptCallAsWaiter(venueId: string, staffId: string, callId: string, now = new Date()) {
  const ctx = await loadCtx(venueId, staffId, now);
  const [call] = await db().select().from(calls).where(and(eq(calls.id, callId), eq(calls.venueId, venueId)));
  if (!ctx || !call || !canSee(ctx, call)) return null;
  return acceptCall(venueId, staffId, callId, now);
}

export async function waiterTable(venueId: string, tableId: string) {
  const [table] = await db().select().from(tables).where(and(eq(tables.id, tableId), eq(tables.venueId, venueId)));
  if (!table) return null;
  const [row] = await db()
    .select({ visit: tableVisits, waiterName: staff.name })
    .from(tableVisits)
    .leftJoin(staff, eq(staff.id, tableVisits.waiterId))
    .where(and(eq(tableVisits.tableId, table.id), inArray(tableVisits.status, ["pending", "open"])));
  if (!row) return { table, visit: null, waiterName: null, calls: [], order: null, items: [] };
  const visitCalls = await db()
    .select()
    .from(calls)
    .where(and(eq(calls.visitId, row.visit.id), inArray(calls.status, ["new", "accepted"])))
    .orderBy(asc(calls.createdAt));
  const order = await visitOrder(row.visit.id);
  const items = order ? await orderItemsOf(order.id) : [];
  return { table, visit: row.visit, waiterName: row.waiterName, calls: visitCalls, order, items };
}

export async function completeCallAsWaiter(venueId: string, staffId: string, callId: string, now = new Date()) {
  const ctx = await loadCtx(venueId, staffId, now);
  const [call] = await db().select().from(calls).where(and(eq(calls.id, callId), eq(calls.venueId, venueId)));
  if (!ctx || !call || (call.status === "new" && !canSee(ctx, call))) return null;
  return completeCall(venueId, staffId, callId, now);
}
