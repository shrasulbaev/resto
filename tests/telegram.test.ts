import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { dishes, staff, tables, venues, type Venue } from "@/db/schema";
import { addItems, closeBill, sendToKitchen } from "@/server/orders";
import { handleUpdate, journal, newLinkCode, setTelegramApi } from "@/server/telegram";
import { openTableByStaff } from "@/server/tables";
import { freshDemo } from "./helpers";

let venue: Venue;
let calls: { method: string; body: Record<string, unknown> }[] = [];

describe("telegram journal", () => {
  beforeEach(async () => {
    venue = await freshDemo();
    calls = [];
    setTelegramApi(async (method, body) => {
      calls.push({ method, body });
      return {};
    });
  });
  afterAll(() => setTelegramApi(null));

  it("links a chat with a one-time code", async () => {
    const code = await newLinkCode(venue.id);
    await handleUpdate({ update_id: 1, message: { chat: { id: -100 }, text: `/link ${code.toLowerCase()}` } });
    const [v] = await db().select().from(venues).where(eq(venues.id, venue.id));
    expect(v).toMatchObject({ telegramChatId: "-100", telegramLinkCode: null });
    expect(String(calls[0].body.text)).toContain("Готово");
    await handleUpdate({ update_id: 2, message: { chat: { id: -200 }, text: `/link ${code}` } });
    expect(String(calls[1].body.text)).toContain("не подошёл");
  });

  it("writes a closed bill into the linked chat", async () => {
    await db().update(venues).set({ telegramChatId: "-100" }).where(eq(venues.id, venue.id));
    const [aibek] = await db().select().from(staff).where(eq(staff.name, "Айбек"));
    const [t] = await db().select().from(tables).where(eq(tables.number, 4));
    const [plov] = await db().select().from(dishes).where(eq(dishes.nameRu, "Плов"));
    const v = (await openTableByStaff(venue.id, aibek.id, t.id))!;
    await addItems(venue.id, aibek.id, v.id, [{ dishId: plov.id, qty: 2, comment: "<острее>" }]);
    await sendToKitchen(venue.id, v.id);
    const res = (await closeBill(venue.id, aibek.id, v.id, "card"))!;
    await journal({ venueId: venue.id, type: "bill_closed", orderId: res.orderId!, tableId: t.id });
    expect(calls).toHaveLength(1);
    expect(calls[0].body.chat_id).toBe("-100");
    const text = String(calls[0].body.text);
    expect(text).toContain("Стол 4");
    expect(text).toContain("Плов × 2");
    expect(text).toContain("&lt;острее&gt;");
    expect(text).toContain("карта");
  });

  it("stays silent for venues without a chat", async () => {
    const [t] = await db().select().from(tables).where(eq(tables.number, 1));
    await journal({ venueId: venue.id, type: "alert", kind: "no_response", tableId: t.id });
    expect(calls).toEqual([]);
  });
});
