import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { dishInterest, dishes, orderItems, orders, tableVisits, tables, venues, type Venue } from "@/db/schema";
import { findTableByToken, guestMenu, hitDishIds, recordInterest } from "@/server/menu";
import { pick } from "@/lib/i18n";
import { freshDemo } from "./helpers";

let venue: Venue;

async function closedOrder(dishName: string, qty: number, closedAt = new Date()) {
  const [table] = await db().select().from(tables).where(eq(tables.venueId, venue.id)).limit(1);
  const [dish] = await db().select().from(dishes).where(eq(dishes.nameRu, dishName));
  const [visit] = await db().insert(tableVisits).values({ venueId: venue.id, tableId: table.id, guestKey: crypto.randomUUID() }).returning();
  const [order] = await db()
    .insert(orders)
    .values({ venueId: venue.id, tableId: table.id, visitId: visit.id, source: "waiter", status: "closed", closedAt })
    .returning();
  await db().insert(orderItems).values({ venueId: venue.id, orderId: order.id, dishId: dish.id, name: dish.nameRu, price: dish.price, qty, status: "served" });
}

describe("guest menu", () => {
  beforeEach(async () => {
    venue = await freshDemo();
  });

  it("finds the venue by a table QR token", async () => {
    const [table] = await db().select().from(tables).limit(1);
    const found = await findTableByToken(table.token);
    expect(found?.venue.id).toBe(venue.id);
    expect(await findTableByToken("nope")).toBeNull();
  });

  it("hides the menu of a disabled venue", async () => {
    const [table] = await db().select().from(tables).limit(1);
    await db().update(venues).set({ active: false }).where(eq(venues.id, venue.id));
    expect(await findTableByToken(table.token)).toBeNull();
  });

  it("hides stop-listed dishes and empty categories", async () => {
    await db().update(dishes).set({ inStock: false }).where(eq(dishes.nameRu, "Самса"));
    const menu = await guestMenu(venue.id);
    const names = menu.flatMap((c) => c.dishes.map((d) => d.nameRu));
    expect(names).not.toContain("Самса");
    expect(menu.map((c) => c.nameRu)).not.toContain("Выпечка");
  });

  it("only shows this venue's menu", async () => {
    const [other] = await db().insert(venues).values({ slug: "other", name: "Другое" }).returning();
    expect(await guestMenu(other.id)).toEqual([]);
  });

  it("puts pinned hits first, then the most ordered dishes of 30 days", async () => {
    await closedOrder("Лагман", 5);
    await closedOrder("Манты", 2);
    await closedOrder("Плов", 50, new Date(Date.now() - 40 * 24 * 3600 * 1000));
    const ids = await hitDishIds(venue.id);
    const names = await Promise.all(ids.map(async (id) => (await db().select().from(dishes).where(eq(dishes.id, id)))[0].nameRu));
    expect(names).toEqual(["Куурдак по-домашнему", "Лагман", "Манты"]);
  });

  it("falls back to Russian when Kyrgyz is missing", () => {
    expect(pick("ky", "Плов", "Палоо")).toBe("Палоо");
    expect(pick("ky", "Плов", null)).toBe("Плов");
    expect(pick("ru", "Плов", "Палоо")).toBe("Плов");
  });

  it("records interest only for the table's own venue dishes", async () => {
    const [table] = await db().select().from(tables).limit(1);
    const [dish] = await db().select().from(dishes).limit(1);
    expect(await recordInterest(table.token, dish.id)).toBe(true);
    const [other] = await db().insert(venues).values({ slug: "o", name: "O" }).returning();
    const [otherTable] = await db().insert(tables).values({ venueId: other.id, number: 1, token: "ot" }).returning();
    expect(await recordInterest(otherTable.token, dish.id)).toBe(false);
    expect(await db().select().from(dishInterest)).toHaveLength(1);
  });
});
