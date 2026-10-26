import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { categories, dishes, venues, type Venue } from "@/db/schema";
import {
  adminMenu, createCategory, deleteCategory, deleteDish, moveCategory, saveDish, setDishFlag,
} from "@/server/admin-menu";
import { guestMenu, hitDishIds } from "@/server/menu";
import { freshDemo } from "./helpers";

let venue: Venue;
let other: Venue;

describe("admin menu", () => {
  beforeEach(async () => {
    venue = await freshDemo();
    [other] = await db().insert(venues).values({ slug: "other", name: "Other" }).returning();
  });

  it("creates a dish with translations and nutrition", async () => {
    const cat = (await createCategory(venue.id, "Десерты", "Десерттер"))!;
    const r = await saveDish(venue.id, null, {
      categoryId: cat.id, nameRu: "Чак-чак", nameKy: "Чак-чак", price: "250", kcal: "410.4", protein: "5", fat: "", carbs: "60",
      allergens: ["глютен", "мёд"], tags: ["new"], descriptionRu: "  ", photoUrl: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dish).toMatchObject({ price: 250, kcal: 410, fat: null, descriptionRu: null, allergens: ["глютен", "мёд"], tags: ["new"] });
  });

  it("rejects a category of another venue and bad input", async () => {
    const [foreign] = await db().insert(categories).values({ venueId: other.id, nameRu: "X" }).returning();
    expect(await saveDish(venue.id, null, { categoryId: foreign.id, nameRu: "A", price: 1 })).toMatchObject({ ok: false, error: "categoryId" });
    const [own] = await db().select().from(categories).where(eq(categories.venueId, venue.id));
    expect(await saveDish(venue.id, null, { categoryId: own.id, nameRu: "", price: 1 })).toMatchObject({ ok: false });
    expect(await saveDish(venue.id, null, { categoryId: own.id, nameRu: "A", price: 1, photoUrl: "https://evil/x.png" })).toMatchObject({ ok: false });
    expect(await saveDish(venue.id, null, { categoryId: own.id, nameRu: "A", price: 1, tags: ["hack"] })).toMatchObject({ ok: false });
  });

  it("stop-list hides a dish from guests but keeps it in admin", async () => {
    const [plov] = await db().select().from(dishes).where(eq(dishes.nameRu, "Плов"));
    await setDishFlag(venue.id, plov.id, "inStock", false);
    const guest = (await guestMenu(venue.id)).flatMap((c) => c.dishes.map((d) => d.id));
    expect(guest).not.toContain(plov.id);
    const admin = (await adminMenu(venue.id)).flatMap((c) => c.dishes.map((d) => d.id));
    expect(admin).toContain(plov.id);
  });

  it("pinning puts a dish into hits", async () => {
    const [manty] = await db().select().from(dishes).where(eq(dishes.nameRu, "Манты"));
    await setDishFlag(venue.id, manty.id, "hitPinned", true);
    expect(await hitDishIds(venue.id)).toContain(manty.id);
  });

  it("owners cannot touch another venue's dishes", async () => {
    const [plov] = await db().select().from(dishes).where(eq(dishes.nameRu, "Плов"));
    expect(await setDishFlag(other.id, plov.id, "inStock", false)).toBe(false);
    expect(await deleteDish(other.id, plov.id)).toBe(false);
    expect(await saveDish(other.id, plov.id, { categoryId: plov.categoryId, nameRu: "X", price: 1 })).toMatchObject({ ok: false });
  });

  it("deletes only empty categories and reorders", async () => {
    const menu = await adminMenu(venue.id);
    expect(await deleteCategory(venue.id, menu[0].id)).toBe(false);
    const empty = (await createCategory(venue.id, "Пусто"))!;
    expect(await moveCategory(venue.id, empty.id, -1)).toBe(true);
    const after = await adminMenu(venue.id);
    expect(after.at(-2)?.id).toBe(empty.id);
    expect(await deleteCategory(venue.id, empty.id)).toBe(true);
  });
});
