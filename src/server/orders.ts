import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { calls, dishes, orderItems, orders, tableVisits, type Order, type TableVisit } from "@/db/schema";
import { publish } from "./events";
import { closeVisit } from "./tables";

/*
 One order per visit is the table's bill. Items start unsent (the waiter is
 still composing), go to the kitchen when sent, then ready -> served.
 Drinks guests take from the fridge themselves skip the kitchen.
*/

export type NewItem = { dishId: string; qty: number; comment?: string | null };

async function activeVisit(venueId: string, visitId: string) {
  const [v] = await db()
    .select()
    .from(tableVisits)
    .where(and(eq(tableVisits.id, visitId), eq(tableVisits.venueId, venueId), eq(tableVisits.status, "open")));
  return v ?? null;
}

export async function visitOrder(visitId: string) {
  const [o] = await db().select().from(orders).where(and(eq(orders.visitId, visitId), ne(orders.status, "cancelled")));
  return o ?? null;
}

async function ensureOrder(visit: TableVisit, staffId: string, source: Order["source"]) {
  const existing = await visitOrder(visit.id);
  if (existing) return existing;
  const [o] = await db()
    .insert(orders)
    .values({ venueId: visit.venueId, tableId: visit.tableId, visitId: visit.id, waiterId: staffId, source })
    .returning();
  return o;
}

async function recalcTotal(orderId: string) {
  const items = await db().select().from(orderItems).where(and(eq(orderItems.orderId, orderId), ne(orderItems.status, "cancelled")));
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  await db().update(orders).set({ total }).where(eq(orders.id, orderId));
  return total;
}

export async function addItems(
  venueId: string,
  staffId: string,
  visitId: string,
  items: NewItem[],
  opts: { selfServed?: boolean; source?: Order["source"]; now?: Date } = {},
) {
  const now = opts.now ?? new Date();
  const visit = await activeVisit(venueId, visitId);
  if (!visit || items.length === 0) return null;
  const ids = [...new Set(items.map((i) => i.dishId))];
  const found = await db().select().from(dishes).where(and(eq(dishes.venueId, venueId), inArray(dishes.id, ids)));
  const byId = new Map(found.map((d) => [d.id, d]));
  const rows = items
    .filter((i) => byId.has(i.dishId) && i.qty > 0)
    .map((i) => {
      const d = byId.get(i.dishId)!;
      return {
        venueId,
        orderId: "",
        dishId: d.id,
        name: d.nameRu,
        price: d.price,
        qty: Math.min(i.qty, 99),
        comment: i.comment?.trim() || null,
        ...(opts.selfServed ? { status: "served" as const, sentAt: now, servedAt: now } : {}),
      };
    });
  if (rows.length === 0) return null;
  const order = await ensureOrder(visit, staffId, opts.source ?? "waiter");
  await db()
    .insert(orderItems)
    .values(rows.map((r) => ({ ...r, orderId: order.id })));
  await recalcTotal(order.id);
  await db().update(tableVisits).set({ lastActivityAt: now }).where(eq(tableVisits.id, visit.id));
  await publish(venueId, { type: "order", orderId: order.id, tableId: visit.tableId });
  return order;
}

async function venueItem(venueId: string, itemId: string) {
  const [row] = await db()
    .select({ item: orderItems, order: orders })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orderItems.id, itemId), eq(orderItems.venueId, venueId)));
  return row ?? null;
}

// Unsent items can be edited freely; sent ones only cancelled.
export async function setItemQty(venueId: string, itemId: string, qty: number) {
  const row = await venueItem(venueId, itemId);
  if (!row || row.item.sentAt || row.order.status === "closed") return false;
  if (qty <= 0) await db().delete(orderItems).where(eq(orderItems.id, itemId));
  else await db().update(orderItems).set({ qty: Math.min(qty, 99) }).where(eq(orderItems.id, itemId));
  await recalcTotal(row.order.id);
  await publish(venueId, { type: "order", orderId: row.order.id, tableId: row.order.tableId });
  return true;
}

export async function cancelItem(venueId: string, itemId: string) {
  const row = await venueItem(venueId, itemId);
  if (!row || row.order.status === "closed" || row.item.status === "cancelled") return false;
  if (!row.item.sentAt) return setItemQty(venueId, itemId, 0);
  await db().update(orderItems).set({ status: "cancelled" }).where(eq(orderItems.id, itemId));
  await recalcTotal(row.order.id);
  await publish(venueId, { type: "order", orderId: row.order.id, tableId: row.order.tableId });
  return true;
}

export async function sendToKitchen(venueId: string, visitId: string, now = new Date()) {
  const order = await visitOrder(visitId);
  if (!order || order.venueId !== venueId || order.status === "closed") return 0;
  const sent = await db()
    .update(orderItems)
    .set({ sentAt: now })
    .where(and(eq(orderItems.orderId, order.id), isNull(orderItems.sentAt)))
    .returning({ id: orderItems.id });
  if (sent.length === 0) return 0;
  await db()
    .update(orders)
    .set({ status: "sent", sentAt: order.sentAt ?? now })
    .where(eq(orders.id, order.id));
  await db().update(tableVisits).set({ lastActivityAt: now }).where(eq(tableVisits.id, visitId));
  await publish(venueId, { type: "order", orderId: order.id, tableId: order.tableId });
  return sent.length;
}

export async function markItemReady(venueId: string, itemId: string, now = new Date()) {
  const row = await venueItem(venueId, itemId);
  if (!row || row.item.status !== "new" || !row.item.sentAt) return false;
  await db().update(orderItems).set({ status: "ready", readyAt: now }).where(eq(orderItems.id, itemId));
  await publish(venueId, { type: "item_ready", orderId: row.order.id, tableId: row.order.tableId, itemId });
  return true;
}

export async function markItemServed(venueId: string, itemId: string, now = new Date()) {
  const row = await venueItem(venueId, itemId);
  if (!row || (row.item.status !== "ready" && row.item.status !== "new") || !row.item.sentAt) return false;
  await db().update(orderItems).set({ status: "served", servedAt: now, readyAt: row.item.readyAt ?? now }).where(eq(orderItems.id, itemId));
  await publish(venueId, { type: "order", orderId: row.order.id, tableId: row.order.tableId });
  return true;
}

// The guest's "My selection" sent with a waiter call becomes unsent items
// the waiter can still edit before sending them to the kitchen.
export async function importCallSelection(venueId: string, staffId: string, callId: string, now = new Date()) {
  const [call] = await db().select().from(calls).where(and(eq(calls.id, callId), eq(calls.venueId, venueId)));
  const selection = call?.payload.selection;
  if (!call || !selection?.length) return null;
  const order = await addItems(venueId, staffId, call.visitId, selection, { source: "guest", now });
  if (!order) return null;
  await db()
    .update(calls)
    .set({ status: "done", doneAt: now, acceptedBy: call.acceptedBy ?? staffId, acceptedAt: call.acceptedAt ?? now })
    .where(eq(calls.id, call.id));
  return order;
}

// Waiter takes payment and closes the table: every guest phone loses its buttons.
export async function closeBill(venueId: string, staffId: string, visitId: string, payment: "cash" | "card", now = new Date()) {
  const visit = await activeVisit(venueId, visitId);
  if (!visit) return null;
  const order = await visitOrder(visit.id);
  let total = 0;
  if (order) {
    // Unsent leftovers were never made; drop them from the bill.
    await db().delete(orderItems).where(and(eq(orderItems.orderId, order.id), isNull(orderItems.sentAt)));
    total = await recalcTotal(order.id);
    await db().update(orders).set({ status: "closed", payment, closedAt: now, total, waiterId: order.waiterId ?? staffId }).where(eq(orders.id, order.id));
  }
  await db()
    .update(calls)
    .set({ status: "done", doneAt: now })
    .where(and(eq(calls.visitId, visit.id), inArray(calls.status, ["new", "accepted"])));
  await closeVisit(visit, "paid", now);
  return { total, orderId: order?.id ?? null };
}

export async function orderItemsOf(orderId: string) {
  return db().select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.createdAt));
}
