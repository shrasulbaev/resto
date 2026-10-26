import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { categories, dishes } from "@/db/schema";
import { publish } from "./events";

// Owner-side menu management. Every query is scoped by the owner's venue.

export const ALLERGENS = ["глютен", "молоко", "яйца", "орехи", "арахис", "соя", "рыба", "морепродукты", "кунжут", "горчица", "сельдерей"];
export const TAGS = [
  { id: "spicy", label: "Острое" },
  { id: "vegetarian", label: "Вегетарианское" },
  { id: "new", label: "Новинка" },
  { id: "self", label: "Гость берёт сам (холодильник)" },
] as const;

// Empty form fields become null.
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
const num = (max: number) =>
  z
    .union([z.number(), z.string()])
    .nullish()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= max), "bad number");

export const dishInput = z.object({
  categoryId: z.string().uuid(),
  nameRu: z.string().trim().min(1).max(80),
  nameKy: text(80),
  descriptionRu: text(300),
  descriptionKy: text(300),
  compositionRu: text(400),
  compositionKy: text(400),
  price: z.coerce.number().int().min(0).max(1_000_000),
  weight: text(30),
  kcal: num(10000).transform((v) => (v === null ? null : Math.round(v))),
  protein: num(1000),
  fat: num(1000),
  carbs: num(1000),
  allergens: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
  tags: z.array(z.enum(TAGS.map((t) => t.id) as [string, ...string[]])).max(10).default([]),
  isSignature: z.boolean().default(false),
  hitPinned: z.boolean().default(false),
  inStock: z.boolean().default(true),
  photoUrl: z.string().regex(/^\/uploads\/[A-Za-z0-9_-]+\.webp$/).nullable().default(null),
});
export type DishInput = z.input<typeof dishInput>;

const menuChanged = (venueId: string) => publish(venueId, { type: "menu" });

export async function adminMenu(venueId: string) {
  const cats = await db().select().from(categories).where(eq(categories.venueId, venueId)).orderBy(asc(categories.sort), asc(categories.createdAt));
  const items = await db().select().from(dishes).where(eq(dishes.venueId, venueId)).orderBy(asc(dishes.sort), asc(dishes.createdAt));
  return cats.map((c) => ({ ...c, dishes: items.filter((d) => d.categoryId === c.id) }));
}

export async function adminDish(venueId: string, dishId: string) {
  const [d] = await db().select().from(dishes).where(and(eq(dishes.id, dishId), eq(dishes.venueId, venueId)));
  return d ?? null;
}

async function ownCategory(venueId: string, categoryId: string) {
  const [c] = await db().select().from(categories).where(and(eq(categories.id, categoryId), eq(categories.venueId, venueId)));
  return c ?? null;
}

export async function createCategory(venueId: string, nameRu: string, nameKy?: string | null) {
  const name = nameRu.trim();
  if (!name || name.length > 60) return null;
  const [{ n }] = await db().select({ n: count() }).from(categories).where(eq(categories.venueId, venueId));
  const [c] = await db().insert(categories).values({ venueId, nameRu: name, nameKy: nameKy?.trim() || null, sort: n }).returning();
  await menuChanged(venueId);
  return c;
}

export async function renameCategory(venueId: string, categoryId: string, nameRu: string, nameKy?: string | null) {
  const name = nameRu.trim();
  if (!name || name.length > 60) return false;
  const res = await db()
    .update(categories)
    .set({ nameRu: name, nameKy: nameKy?.trim() || null })
    .where(and(eq(categories.id, categoryId), eq(categories.venueId, venueId)))
    .returning({ id: categories.id });
  if (res.length) await menuChanged(venueId);
  return res.length > 0;
}

// Only empty categories can be deleted, so dishes are never lost by accident.
export async function deleteCategory(venueId: string, categoryId: string) {
  const [{ n }] = await db().select({ n: count() }).from(dishes).where(and(eq(dishes.categoryId, categoryId), eq(dishes.venueId, venueId)));
  if (n > 0) return false;
  const res = await db().delete(categories).where(and(eq(categories.id, categoryId), eq(categories.venueId, venueId))).returning({ id: categories.id });
  if (res.length) await menuChanged(venueId);
  return res.length > 0;
}

export async function moveCategory(venueId: string, categoryId: string, dir: -1 | 1) {
  const cats = await db().select().from(categories).where(eq(categories.venueId, venueId)).orderBy(asc(categories.sort), asc(categories.createdAt));
  const i = cats.findIndex((c) => c.id === categoryId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= cats.length) return false;
  [cats[i], cats[j]] = [cats[j], cats[i]];
  for (const [k, c] of cats.entries()) await db().update(categories).set({ sort: k }).where(eq(categories.id, c.id));
  await menuChanged(venueId);
  return true;
}

export async function saveDish(venueId: string, dishId: string | null, raw: unknown) {
  const parsed = dishInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.path.join(".") ?? "invalid" };
  const data = parsed.data;
  if (!(await ownCategory(venueId, data.categoryId))) return { ok: false as const, error: "categoryId" };
  if (dishId) {
    const res = await db().update(dishes).set(data).where(and(eq(dishes.id, dishId), eq(dishes.venueId, venueId))).returning();
    if (!res.length) return { ok: false as const, error: "not_found" };
    await menuChanged(venueId);
    return { ok: true as const, dish: res[0] };
  }
  const [{ n }] = await db().select({ n: count() }).from(dishes).where(eq(dishes.categoryId, data.categoryId));
  const [dish] = await db().insert(dishes).values({ ...data, venueId, sort: n }).returning();
  await menuChanged(venueId);
  return { ok: true as const, dish };
}

export async function deleteDish(venueId: string, dishId: string) {
  const res = await db().delete(dishes).where(and(eq(dishes.id, dishId), eq(dishes.venueId, venueId))).returning({ id: dishes.id });
  if (res.length) await menuChanged(venueId);
  return res.length > 0;
}

type Flag = "inStock" | "hitPinned" | "isSignature";

export async function setDishFlag(venueId: string, dishId: string, flag: Flag, value: boolean) {
  const res = await db()
    .update(dishes)
    .set({ [flag]: value })
    .where(and(eq(dishes.id, dishId), eq(dishes.venueId, venueId)))
    .returning({ id: dishes.id });
  if (res.length) await menuChanged(venueId);
  return res.length > 0;
}

export async function moveDish(venueId: string, dishId: string, dir: -1 | 1) {
  const d = await adminDish(venueId, dishId);
  if (!d) return false;
  const list = await db().select().from(dishes).where(eq(dishes.categoryId, d.categoryId)).orderBy(asc(dishes.sort), asc(dishes.createdAt));
  const i = list.findIndex((x) => x.id === dishId);
  const j = i + dir;
  if (j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  for (const [k, x] of list.entries()) await db().update(dishes).set({ sort: k }).where(eq(dishes.id, x.id));
  await menuChanged(venueId);
  return true;
}
