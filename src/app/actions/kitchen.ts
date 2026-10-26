"use server";

import { revalidatePath } from "next/cache";
import { markItemReady } from "@/server/orders";
import { requireStaff } from "@/server/session";

export async function readyAction(itemIds: string[]) {
  const s = await requireStaff("kitchen");
  let n = 0;
  for (const id of itemIds.slice(0, 50)) if (await markItemReady(s.venueId, String(id))) n++;
  revalidatePath("/kitchen");
  return n;
}
