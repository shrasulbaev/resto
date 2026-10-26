import { and, asc, eq, inArray, max } from "drizzle-orm";
import QRCode from "qrcode";
import { z } from "zod";
import { db } from "@/db/client";
import { staff, tableVisits, tables, venues, waiterTables } from "@/db/schema";
import { env } from "@/lib/env";
import { hashSecret } from "@/lib/passwords";
import { randomToken } from "@/lib/tokens";
import { publish } from "./events";
import { closeVisit } from "./tables";

// Owner-side tables, QR codes, staff and venue rules. Scoped by venue.

export function tableUrl(token: string) {
  return `${env().APP_URL.replace(/\/$/, "")}/t/${token}`;
}

export function qrSvg(token: string) {
  return QRCode.toString(tableUrl(token), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
}

export async function adminTables(venueId: string) {
  const list = await db().select().from(tables).where(eq(tables.venueId, venueId)).orderBy(asc(tables.number));
  const links = list.length
    ? await db().select().from(waiterTables).where(inArray(waiterTables.tableId, list.map((t) => t.id)))
    : [];
  return list.map((t) => ({ ...t, waiterIds: links.filter((l) => l.tableId === t.id).map((l) => l.staffId) }));
}

export async function addTables(venueId: string, n: number) {
  const count = Math.min(Math.max(Math.trunc(n), 1), 100);
  const [{ top }] = await db().select({ top: max(tables.number) }).from(tables).where(eq(tables.venueId, venueId));
  const start = (top ?? 0) + 1;
  await db()
    .insert(tables)
    .values(Array.from({ length: count }, (_, i) => ({ venueId, number: start + i, token: randomToken() })));
  return count;
}

async function closeActive(venueId: string, tableId: string) {
  const [v] = await db()
    .select()
    .from(tableVisits)
    .where(and(eq(tableVisits.tableId, tableId), eq(tableVisits.venueId, venueId), inArray(tableVisits.status, ["pending", "open"])));
  if (v) await closeVisit(v, "manual");
}

// A new QR makes old photos/screenshots of the code useless.
export async function reissueQr(venueId: string, tableId: string) {
  const res = await db()
    .update(tables)
    .set({ token: randomToken() })
    .where(and(eq(tables.id, tableId), eq(tables.venueId, venueId)))
    .returning();
  if (!res.length) return null;
  await closeActive(venueId, tableId);
  return res[0];
}

export async function renumberTable(venueId: string, tableId: string, number: number) {
  if (!Number.isInteger(number) || number < 1 || number > 9999) return false;
  const [clash] = await db().select().from(tables).where(and(eq(tables.venueId, venueId), eq(tables.number, number)));
  if (clash && clash.id !== tableId) return false;
  const res = await db().update(tables).set({ number }).where(and(eq(tables.id, tableId), eq(tables.venueId, venueId))).returning();
  return res.length > 0;
}

export async function deleteTable(venueId: string, tableId: string) {
  const [t] = await db().select().from(tables).where(and(eq(tables.id, tableId), eq(tables.venueId, venueId)));
  if (!t || t.status !== "closed") return false;
  await db().delete(tables).where(eq(tables.id, t.id));
  return true;
}

// Staff

const PIN = /^\d{4,6}$/;

export async function adminStaff(venueId: string) {
  return db()
    .select({ id: staff.id, name: staff.name, role: staff.role, active: staff.active, hasPin: staff.pinHash })
    .from(staff)
    .where(eq(staff.venueId, venueId))
    .orderBy(asc(staff.role), asc(staff.name))
    .then((rows) => rows.map((r) => ({ ...r, hasPin: !!r.hasPin })));
}

export async function createStaff(venueId: string, input: { name: string; role: string; pin: string }) {
  const name = input.name.trim();
  if (!name || name.length > 40 || !PIN.test(input.pin)) return null;
  if (input.role !== "waiter" && input.role !== "kitchen") return null;
  const [s] = await db()
    .insert(staff)
    .values({ venueId, name, role: input.role, pinHash: await hashSecret(input.pin) })
    .returning({ id: staff.id });
  return s;
}

export async function updateStaff(venueId: string, staffId: string, input: { name?: string; active?: boolean; pin?: string }) {
  const patch: Partial<typeof staff.$inferInsert> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name || name.length > 40) return false;
    patch.name = name;
  }
  if (input.active !== undefined) patch.active = input.active;
  if (input.pin !== undefined) {
    if (!PIN.test(input.pin)) return false;
    patch.pinHash = await hashSecret(input.pin);
  }
  const res = await db().update(staff).set(patch).where(and(eq(staff.id, staffId), eq(staff.venueId, venueId))).returning({ id: staff.id });
  return res.length > 0;
}

export async function setWaiterTables(venueId: string, staffId: string, tableIds: string[]) {
  const [s] = await db().select().from(staff).where(and(eq(staff.id, staffId), eq(staff.venueId, venueId), eq(staff.role, "waiter")));
  if (!s) return false;
  const own = tableIds.length
    ? await db().select({ id: tables.id }).from(tables).where(and(eq(tables.venueId, venueId), inArray(tables.id, tableIds)))
    : [];
  await db().delete(waiterTables).where(eq(waiterTables.staffId, staffId));
  if (own.length) await db().insert(waiterTables).values(own.map((t) => ({ staffId, tableId: t.id })));
  return true;
}

// Venue rules

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const settingsInput = z
  .object({
    allDay: z.boolean(),
    opensAt: hhmm.nullish(),
    closesAt: hhmm.nullish(),
    callPauseMin: z.coerce.number().int().min(1).max(30),
    maxPendingCalls: z.coerce.number().int().min(1).max(10),
    autoCloseHours: z.coerce.number().int().min(1).max(24),
    assignmentMode: z.enum(["any", "assigned"]),
    escalateAfterMin: z.coerce.number().int().min(1).max(30),
  })
  .refine((v) => v.allDay || (v.opensAt && v.closesAt), { path: ["opensAt"] });

export async function saveSettings(venueId: string, raw: unknown) {
  const p = settingsInput.safeParse(raw);
  if (!p.success) return { ok: false as const, error: String(p.error.issues[0]?.path[0] ?? "invalid") };
  const v = p.data;
  await db()
    .update(venues)
    .set({
      opensAt: v.allDay ? null : v.opensAt!,
      closesAt: v.allDay ? null : v.closesAt!,
      callPauseSec: v.callPauseMin * 60,
      maxPendingCalls: v.maxPendingCalls,
      autoCloseHours: v.autoCloseHours,
      assignmentMode: v.assignmentMode,
      escalateAfterSec: v.escalateAfterMin * 60,
    })
    .where(eq(venues.id, venueId));
  await publish(venueId, { type: "menu" });
  return { ok: true as const };
}

// Branding: each venue sets only its logo and menu background.

const upload = z.string().regex(/^\/uploads\/[A-Za-z0-9_-]+\.webp$/).nullable();
export const brandingInput = z.object({ logoUrl: upload, backgroundUrl: upload, backgroundDim: z.coerce.number().int().min(0).max(90) });

export async function saveBranding(venueId: string, raw: unknown) {
  const p = brandingInput.safeParse(raw);
  if (!p.success) return false;
  await db().update(venues).set(p.data).where(eq(venues.id, venueId));
  await publish(venueId, { type: "menu" });
  return true;
}
