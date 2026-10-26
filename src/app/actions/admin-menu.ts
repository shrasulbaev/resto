"use server";

import { revalidatePath } from "next/cache";
import {
  createCategory, deleteCategory, deleteDish, moveCategory, moveDish, renameCategory, saveDish, setDishFlag,
} from "@/server/admin-menu";
import { requireOwner } from "@/server/session";
import { saveImage } from "@/server/uploads";

const done = () => revalidatePath("/admin/menu", "layout");

export async function createCategoryAction(form: FormData) {
  const s = await requireOwner();
  await createCategory(s.venueId, String(form.get("nameRu") ?? ""), String(form.get("nameKy") ?? ""));
  done();
}

export async function renameCategoryAction(id: string, nameRu: string, nameKy: string) {
  const s = await requireOwner();
  const ok = await renameCategory(s.venueId, id, nameRu, nameKy);
  done();
  return ok;
}

export async function deleteCategoryAction(id: string) {
  const s = await requireOwner();
  const ok = await deleteCategory(s.venueId, id);
  done();
  return ok;
}

export async function moveCategoryAction(id: string, dir: -1 | 1) {
  const s = await requireOwner();
  await moveCategory(s.venueId, id, dir === -1 ? -1 : 1);
  done();
}

export async function moveDishAction(id: string, dir: -1 | 1) {
  const s = await requireOwner();
  await moveDish(s.venueId, id, dir === -1 ? -1 : 1);
  done();
}

export async function setDishFlagAction(id: string, flag: "inStock" | "hitPinned" | "isSignature", value: boolean) {
  const s = await requireOwner();
  if (!["inStock", "hitPinned", "isSignature"].includes(flag)) return false;
  const ok = await setDishFlag(s.venueId, id, flag, !!value);
  done();
  return ok;
}

export async function saveDishAction(id: string | null, data: unknown) {
  const s = await requireOwner();
  const r = await saveDish(s.venueId, id, data);
  done();
  return r.ok ? { ok: true as const, id: r.dish.id } : { ok: false as const, error: r.error };
}

export async function deleteDishAction(id: string) {
  const s = await requireOwner();
  const ok = await deleteDish(s.venueId, id);
  done();
  return ok;
}

export async function uploadImageAction(form: FormData) {
  await requireOwner();
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "no_file" };
  try {
    return { ok: true as const, url: await saveImage(file) };
  } catch {
    return { ok: false as const, error: "bad_image" };
  }
}
