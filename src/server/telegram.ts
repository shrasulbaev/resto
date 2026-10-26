import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { orderItems, orders, staff, tables, venues } from "@/db/schema";
import { env } from "@/lib/env";
import { formatSom } from "@/lib/i18n";
import type { VenueMessage } from "./realtime";

/*
 Backup journal: a platform bot writes every closed bill (and unanswered
 tables) into the venue's Telegram chat. The owner links a chat by sending
 "/link CODE" to the bot. Updates are long-polled, so no public webhook is needed.
*/

type Api = (method: string, body: Record<string, unknown>) => Promise<unknown>;

const defaultApi: Api = async (method, body) => {
  const token = env().TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(40_000),
  });
  const json = (await res.json()) as { ok: boolean; result?: unknown; description?: string };
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description}`);
  return json.result;
};
let api: Api = defaultApi;

export function setTelegramApi(a: Api | null) {
  api = a ?? defaultApi;
}

export function telegramEnabled() {
  return api !== defaultApi || !!env().TELEGRAM_BOT_TOKEN;
}

let botName: string | null = null;
export async function botUsername() {
  if (!telegramEnabled()) return null;
  if (!botName) {
    const me = (await api("getMe", {}).catch(() => null)) as { username?: string } | null;
    botName = me?.username ?? null;
  }
  return botName;
}

export async function newLinkCode(venueId: string) {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  await db().update(venues).set({ telegramLinkCode: code }).where(eq(venues.id, venueId));
  return code;
}

export async function unlinkChat(venueId: string) {
  await db().update(venues).set({ telegramChatId: null, telegramLinkCode: null }).where(eq(venues.id, venueId));
}

export async function linkChat(code: string, chatId: string) {
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(clean)) return null;
  const [v] = await db()
    .update(venues)
    .set({ telegramChatId: chatId, telegramLinkCode: null })
    .where(eq(venues.telegramLinkCode, clean))
    .returning({ name: venues.name });
  return v ?? null;
}

const escape = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export async function billText(orderId: string) {
  const [row] = await db()
    .select({ order: orders, table: tables.number, waiter: staff.name, tz: venues.timezone })
    .from(orders)
    .innerJoin(tables, eq(tables.id, orders.tableId))
    .innerJoin(venues, eq(venues.id, orders.venueId))
    .leftJoin(staff, eq(staff.id, orders.waiterId))
    .where(eq(orders.id, orderId));
  if (!row) return null;
  const items = await db()
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), ne(orderItems.status, "cancelled")))
    .orderBy(asc(orderItems.createdAt));
  const time = row.order.closedAt
    ? new Intl.DateTimeFormat("ru-RU", { timeZone: row.tz, hour: "2-digit", minute: "2-digit" }).format(row.order.closedAt)
    : "";
  const pay = row.order.payment === "card" ? "карта" : row.order.payment === "cash" ? "наличные" : "";
  return [
    `🧾 <b>Стол ${row.table}</b> · ${time} · ${escape(row.waiter ?? "—")}`,
    ...items.map((i) => `• ${escape(i.name)} × ${i.qty} — ${formatSom(i.price * i.qty)}${i.comment ? ` (${escape(i.comment)})` : ""}`),
    `<b>Итого: ${formatSom(row.order.total)}</b>${pay ? ` · ${pay}` : ""}`,
  ].join("\n");
}

async function chatOf(venueId: string) {
  const [v] = await db().select({ chat: venues.telegramChatId }).from(venues).where(eq(venues.id, venueId));
  return v?.chat ?? null;
}

export async function journal(e: VenueMessage) {
  if (!telegramEnabled() || (e.type !== "bill_closed" && e.type !== "alert")) return;
  const chat = await chatOf(e.venueId);
  if (!chat) return;
  let text: string | null = null;
  if (e.type === "bill_closed") text = await billText(e.orderId);
  else {
    const [t] = await db().select({ number: tables.number }).from(tables).where(eq(tables.id, e.tableId));
    text = `⚠️ Стол ${t?.number ?? "?"}: гость звал официанта, никто не подошёл. Стол закрыт.`;
  }
  if (text) await api("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_notification: e.type === "bill_closed" });
}

type Update = { update_id: number; message?: { chat: { id: number }; text?: string } };

export async function handleUpdate(u: Update) {
  const text = u.message?.text?.trim();
  const chatId = u.message?.chat.id;
  if (!text || chatId === undefined) return;
  const m = text.match(/^\/(?:start|link)(?:@\w+)?\s+(\S+)/i);
  if (m) {
    const v = await linkChat(m[1], String(chatId));
    await api("sendMessage", {
      chat_id: chatId,
      text: v ? `Готово. Сюда будут приходить закрытые счета «${v.name}».` : "Код не подошёл. Получите новый в админке: Настройки → Telegram.",
    });
  } else if (/^\/(start|help)/i.test(text)) {
    await api("sendMessage", { chat_id: chatId, text: "Отправьте /link КОД — код есть в админке заведения: Настройки → Telegram." });
  }
}

export async function startTelegramPolling() {
  const g = globalThis as unknown as { tgPolling?: boolean };
  if (g.tgPolling || !env().TELEGRAM_BOT_TOKEN) return;
  g.tgPolling = true;
  let offset = 0;
  for (;;) {
    try {
      const updates = (await api("getUpdates", { offset, timeout: 30, allowed_updates: ["message"] })) as Update[];
      for (const u of updates) {
        offset = u.update_id + 1;
        await handleUpdate(u).catch((e) => console.error("telegram update failed", e));
      }
    } catch (e) {
      console.error("telegram polling", (e as Error).message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
