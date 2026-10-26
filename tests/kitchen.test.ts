import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { dishes, staff, tables, venues, type Venue } from "@/db/schema";
import { kitchenBoard } from "@/server/kitchen";
import { addItems, closeBill, markItemReady, markItemServed, sendToKitchen } from "@/server/orders";
import { openTableByStaff } from "@/server/tables";
import { freshDemo } from "./helpers";

let venue: Venue;
let waiter: string;

async function dishId(name: string) {
  const [d] = await db().select().from(dishes).where(and(eq(dishes.venueId, venue.id), eq(dishes.nameRu, name)));
  return d.id;
}

async function openWith(number: number, names: string[], send = true) {
  const [t] = await db().select().from(tables).where(eq(tables.number, number));
  const v = (await openTableByStaff(venue.id, waiter, t.id))!;
  await addItems(venue.id, waiter, v.id, await Promise.all(names.map(async (n) => ({ dishId: await dishId(n), qty: 1 }))));
  if (send) await sendToKitchen(venue.id, v.id);
  return v;
}

describe("kitchen board", () => {
  beforeEach(async () => {
    venue = await freshDemo();
    [{ id: waiter }] = await db().select().from(staff).where(eq(staff.name, "Айбек"));
  });

  it("shows only sent dishes grouped by table", async () => {
    await openWith(3, ["Плов", "Манты"]);
    await openWith(4, ["Лагман"], false);
    const board = await kitchenBoard(venue.id);
    expect(board).toHaveLength(1);
    expect(board[0]).toMatchObject({ tableNumber: 3, waiterName: "Айбек" });
    expect(board[0].items.map((i) => i.name).sort()).toEqual(["Манты", "Плов"]);
  });

  it("keeps ready dishes until served and drops closed bills", async () => {
    const v = await openWith(3, ["Плов", "Манты"]);
    let [ticket] = await kitchenBoard(venue.id);
    const plov = ticket.items.find((i) => i.name === "Плов")!;
    await markItemReady(venue.id, plov.id);
    [ticket] = await kitchenBoard(venue.id);
    expect(ticket.items.find((i) => i.id === plov.id)?.status).toBe("ready");
    await markItemServed(venue.id, plov.id);
    [ticket] = await kitchenBoard(venue.id);
    expect(ticket.items).toHaveLength(1);
    await closeBill(venue.id, waiter, v.id, "cash");
    expect(await kitchenBoard(venue.id)).toEqual([]);
  });

  it("is per venue", async () => {
    await openWith(3, ["Плов"]);
    const [other] = await db().insert(venues).values({ slug: "o", name: "O" }).returning();
    expect(await kitchenBoard(other.id)).toEqual([]);
    const [ticket] = await kitchenBoard(venue.id);
    expect(await markItemReady(other.id, ticket.items[0].id)).toBe(false);
  });
});
