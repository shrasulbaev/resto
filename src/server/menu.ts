import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, dishInterest, dishes, orderItems, orders, tables, venues, type Category, type Dish } from "@/db/schema";

export async function findTableByToken(token: string) {
  const [row] = await db()
    .select({ table: tables, venue: venues })
    .from(tables)
    .innerJoin(venues, eq(venues.id, tables.venueId))
    .where(and(eq(tables.token, token), eq(venues.active, true)));
  return row ?? null;
}

export type MenuCategory = Category & { dishes: Dish[] };

// Guests never see stop-listed dishes.
export async function guestMenu(venueId: string): Promise<MenuCategory[]> {
  const cats = await db()
    .select()
    .from(categories)
    .where(eq(categories.venueId, venueId))
    .orderBy(asc(categories.sort), asc(categories.createdAt));
  const items = await db()
    .select()
    .from(dishes)
    .where(and(eq(dishes.venueId, venueId), eq(dishes.inStock, true)))
    .orderBy(asc(dishes.sort), asc(dishes.createdAt));
  return cats
    .map((c) => ({ ...c, dishes: items.filter((d) => d.categoryId === c.id) }))
    .filter((c) => c.dishes.length > 0);
}

// Hits = dishes the owner pinned, then the most ordered over the last 30 days.
export async function hitDishIds(venueId: string, limit = 6, now = new Date()): Promise<string[]> {
  const since = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const pinned = await db()
    .select({ id: dishes.id })
    .from(dishes)
    .where(and(eq(dishes.venueId, venueId), eq(dishes.hitPinned, true), eq(dishes.inStock, true)))
    .orderBy(asc(dishes.sort));
  const qty = sql<number>`sum(${orderItems.qty})`;
  const top = await db()
    .select({ id: orderItems.dishId, qty })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(dishes, eq(dishes.id, orderItems.dishId))
    .where(
      and(
        eq(orderItems.venueId, venueId),
        eq(orders.status, "closed"),
        gte(orders.closedAt, since),
        inArray(orderItems.status, ["new", "ready", "served"]),
        eq(dishes.inStock, true),
      ),
    )
    .groupBy(orderItems.dishId)
    .orderBy(desc(qty))
    .limit(limit);
  const ids = [...pinned.map((p) => p.id)];
  for (const t of top) if (t.id && !ids.includes(t.id)) ids.push(t.id);
  return ids.slice(0, limit);
}

// Counts a dish put into "My selection"; only dishes of the table's own venue.
export async function recordInterest(tableToken: string, dishId: string) {
  const found = await findTableByToken(tableToken);
  if (!found) return false;
  const [dish] = await db()
    .select({ id: dishes.id })
    .from(dishes)
    .where(and(eq(dishes.id, dishId), eq(dishes.venueId, found.venue.id)));
  if (!dish) return false;
  await db().insert(dishInterest).values({ venueId: found.venue.id, dishId });
  return true;
}
