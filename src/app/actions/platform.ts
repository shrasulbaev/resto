"use server";

import { revalidatePath } from "next/cache";
import { createVenue, resetOwnerPassword, setVenueActive } from "@/server/platform";
import { requirePlatform } from "@/server/session";

export async function createVenueAction(data: unknown) {
  await requirePlatform();
  const r = await createVenue(data);
  revalidatePath("/platform");
  return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
}

export async function setVenueActiveAction(id: string, active: boolean) {
  await requirePlatform();
  await setVenueActive(String(id), !!active);
  revalidatePath("/platform");
}

export async function resetOwnerPasswordAction(email: string, password: string) {
  await requirePlatform();
  return resetOwnerPassword(String(email), String(password));
}
