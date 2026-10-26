import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { orderItems, orders, staff, tables } from "@/db/schema";

export type KitchenItem = { id: string; name: string; qty: number; comment: string | null; status: "new" | "ready"; sentAt: string };
export type KitchenTicket = { orderId: string; tableNumber: number; waiterName: string | null; items: KitchenItem[]; firstSentAt: string };

// Sent dishes still to cook, grouped by table; ready ones stay visible
// (greyed) until the waiter takes them so the cook sees what is waiting.
export async function kitchenBoard(venueId: string): Promise<KitchenTicket[]> {
  const rows = await db()
    .select({ item: orderItems, tableNumber: tables.number, waiterName: staff.name, orderId: orders.id })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(tables, eq(tables.id, orders.tableId))
    .leftJoin(staff, eq(staff.id, orders.waiterId))
    .where(
      and(
        eq(orderItems.venueId, venueId),
        eq(orders.status, "sent"),
        isNotNull(orderItems.sentAt),
        inArray(orderItems.status, ["new", "ready"]),
      ),
    )
    .orderBy(asc(orderItems.sentAt), asc(orderItems.createdAt), asc(orderItems.id));
  const byOrder = new Map<string, KitchenTicket>();
  for (const r of rows) {
    let t = byOrder.get(r.orderId);
    if (!t) {
      t = { orderId: r.orderId, tableNumber: r.tableNumber, waiterName: r.waiterName, items: [], firstSentAt: r.item.sentAt!.toISOString() };
      byOrder.set(r.orderId, t);
    }
    t.items.push({
      id: r.item.id,
      name: r.item.name,
      qty: r.item.qty,
      comment: r.item.comment,
      status: r.item.status as "new" | "ready",
      sentAt: r.item.sentAt!.toISOString(),
    });
  }
  // Tickets with nothing left to cook go to the end.
  return [...byOrder.values()].sort((a, b) => {
    const aw = a.items.some((i) => i.status === "new") ? 0 : 1;
    const bw = b.items.some((i) => i.status === "new") ? 0 : 1;
    return aw - bw || a.firstSentAt.localeCompare(b.firstSentAt);
  });
}
