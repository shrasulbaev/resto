"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addItems, cancelItem, closeBill, importCallSelection, markItemServed, sendToKitchen, setItemQty,
} from "@/server/orders";
import { requireStaff } from "@/server/session";
import { openTableByStaff } from "@/server/tables";
import { acceptCallAsWaiter, completeCallAsWaiter } from "@/server/waiter";

// Every action takes the venue from the waiter's session, never from input.

const done = () => revalidatePath("/waiter", "layout");

export async function acceptCallAction(callId: string) {
  const s = await requireStaff("waiter");
  const ok = !!(await acceptCallAsWaiter(s.venueId, s.staffId, callId));
  done();
  return ok;
}

export async function completeCallAction(callId: string) {
  const s = await requireStaff("waiter");
  const ok = !!(await completeCallAsWaiter(s.venueId, s.staffId, callId));
  done();
  return ok;
}

export async function importSelectionAction(callId: string) {
  const s = await requireStaff("waiter");
  await acceptCallAsWaiter(s.venueId, s.staffId, callId);
  const ok = !!(await importCallSelection(s.venueId, s.staffId, callId));
  done();
  return ok;
}

export async function openTableAction(tableId: string) {
  const s = await requireStaff("waiter");
  const ok = !!(await openTableByStaff(s.venueId, s.staffId, tableId));
  done();
  return ok;
}

const itemsSchema = z
  .array(z.object({ dishId: z.string().uuid(), qty: z.number().int().min(1).max(99), comment: z.string().max(120).nullish() }))
  .min(1)
  .max(100);

export async function addItemsAction(visitId: string, items: unknown, selfServed = false) {
  const s = await requireStaff("waiter");
  const parsed = itemsSchema.safeParse(items);
  if (!parsed.success) return false;
  const ok = !!(await addItems(s.venueId, s.staffId, visitId, parsed.data, { selfServed }));
  done();
  return ok;
}

export async function setItemQtyAction(itemId: string, qty: number) {
  const s = await requireStaff("waiter");
  const ok = await setItemQty(s.venueId, itemId, Math.trunc(qty));
  done();
  return ok;
}

export async function cancelItemAction(itemId: string) {
  const s = await requireStaff("waiter");
  const ok = await cancelItem(s.venueId, itemId);
  done();
  return ok;
}

export async function servedAction(itemId: string) {
  const s = await requireStaff("waiter");
  const ok = await markItemServed(s.venueId, itemId);
  done();
  return ok;
}

export async function sendToKitchenAction(visitId: string) {
  const s = await requireStaff("waiter");
  const n = await sendToKitchen(s.venueId, visitId);
  done();
  return n;
}

export async function closeBillAction(visitId: string, payment: "cash" | "card") {
  const s = await requireStaff("waiter");
  if (payment !== "cash" && payment !== "card") return null;
  const res = await closeBill(s.venueId, s.staffId, visitId, payment);
  done();
  return res;
}
