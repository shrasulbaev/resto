import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { calls, orderItems, orders, tableVisits, tables, users } from "@/db/schema";
import { pushToStaff, pushToUsers } from "./push";
import { subscribeAll, type VenueMessage } from "./realtime";
import { callAudience } from "./waiter";

/*
 Turns venue events into pushes:
   new call        -> waiters who should take it (all of them once escalated)
   dish ready      -> the table's waiter
   no response     -> the owner
 Extra channels (Telegram journal) hook in through `extraHandlers`.
*/

export const extraHandlers: ((e: VenueMessage) => Promise<void>)[] = [];

function callTitle(type: string, payload: { payment?: string; comment?: string }) {
  if (type === "bill") return `Счёт · ${payload.payment === "card" ? "картой" : "наличными"}`;
  if (type === "container") return "Просят контейнер";
  if (type === "other") return payload.comment ?? "Просьба";
  return "Зовут официанта";
}

async function tableNumber(tableId: string) {
  const [t] = await db().select({ number: tables.number }).from(tables).where(eq(tables.id, tableId));
  return t?.number ?? "?";
}

export async function handleEvent(e: VenueMessage) {
  if (e.type === "call") {
    const [call] = await db().select().from(calls).where(and(eq(calls.id, e.callId), eq(calls.venueId, e.venueId)));
    if (!call || call.status !== "new") return;
    const audience = await callAudience(e.venueId, call);
    const n = await tableNumber(call.tableId);
    await pushToStaff(e.venueId, audience, {
      title: `Стол ${n} · ${callTitle(call.type, call.payload)}`,
      body: e.escalated ? "Никто не принял вовремя — возьмите, если свободны" : call.attempt > 1 ? `Зовут уже ${call.attempt}-й раз` : "Нажмите, чтобы открыть вызовы",
      url: "/waiter",
      tag: `call-${call.id}`,
      urgent: true,
    });
  } else if (e.type === "item_ready") {
    const [row] = await db()
      .select({ name: orderItems.name, qty: orderItems.qty, orderWaiter: orders.waiterId, visitWaiter: tableVisits.waiterId })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(tableVisits, eq(tableVisits.id, orders.visitId))
      .where(and(eq(orderItems.id, e.itemId), eq(orderItems.venueId, e.venueId)));
    const waiter = row?.visitWaiter ?? row?.orderWaiter;
    if (!row || !waiter) return;
    const n = await tableNumber(e.tableId);
    await pushToStaff(e.venueId, [waiter], {
      title: `Стол ${n} · готово`,
      body: `${row.qty > 1 ? `${row.qty} × ` : ""}${row.name}`,
      url: `/waiter/t/${e.tableId}`,
      tag: `ready-${e.tableId}`,
    });
  } else if (e.type === "alert") {
    const owners = await db().select({ id: users.id }).from(users).where(and(eq(users.venueId, e.venueId), eq(users.role, "owner")));
    const n = await tableNumber(e.tableId);
    await pushToUsers(e.venueId, owners.map((o) => o.id), {
      title: `Стол ${n}: к гостю никто не подошёл`,
      body: "Гость звал официанта, ответа не было, стол закрыт",
      url: "/admin/stats",
      tag: `alert-${e.tableId}`,
    });
  }
  for (const h of extraHandlers) await h(e);
}

export async function startNotifier() {
  const g = globalThis as unknown as { notifierStarted?: boolean };
  if (g.notifierStarted) return;
  g.notifierStarted = true;
  await subscribeAll((e) => {
    handleEvent(e).catch((err) => console.error("notify failed", err));
  });
}
