import { asc, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { staff, tables, users, venues } from "@/db/schema";
import { hashSecret } from "@/lib/passwords";
import { randomToken } from "@/lib/tokens";

// Platform admin: onboarding venues. Each venue is isolated by venue_id.

export async function platformVenues() {
  const list = await db().select().from(venues).orderBy(asc(venues.createdAt));
  const tableCounts = await db().select({ venueId: tables.venueId, n: count() }).from(tables).groupBy(tables.venueId);
  const staffCounts = await db().select({ venueId: staff.venueId, n: count() }).from(staff).groupBy(staff.venueId);
  const owners = await db().select({ venueId: users.venueId, email: users.email }).from(users).where(eq(users.role, "owner"));
  return list.map((v) => ({
    id: v.id,
    name: v.name,
    slug: v.slug,
    active: v.active,
    tables: tableCounts.find((c) => c.venueId === v.id)?.n ?? 0,
    staff: staffCounts.find((c) => c.venueId === v.id)?.n ?? 0,
    owners: owners.filter((o) => o.venueId === v.id).map((o) => o.email),
  }));
}

export const venueInput = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/),
  ownerEmail: z.string().trim().toLowerCase().email(),
  ownerPassword: z.string().min(8).max(100),
  tables: z.coerce.number().int().min(0).max(200).default(10),
});

export async function createVenue(raw: unknown) {
  const p = venueInput.safeParse(raw);
  if (!p.success) return { ok: false as const, error: String(p.error.issues[0]?.path[0] ?? "invalid") };
  const v = p.data;
  const [slugTaken] = await db().select({ id: venues.id }).from(venues).where(eq(venues.slug, v.slug));
  if (slugTaken) return { ok: false as const, error: "slug_taken" };
  const [emailTaken] = await db().select({ id: users.id }).from(users).where(eq(users.email, v.ownerEmail));
  if (emailTaken) return { ok: false as const, error: "email_taken" };
  const venue = await db().transaction(async (tx) => {
    const [created] = await tx.insert(venues).values({ name: v.name, slug: v.slug }).returning();
    await tx.insert(users).values({ email: v.ownerEmail, passwordHash: await hashSecret(v.ownerPassword), name: v.name, role: "owner", venueId: created.id });
    if (v.tables > 0) {
      await tx.insert(tables).values(Array.from({ length: v.tables }, (_, i) => ({ venueId: created.id, number: i + 1, token: randomToken() })));
    }
    return created;
  });
  return { ok: true as const, venue };
}

export async function setVenueActive(venueId: string, active: boolean) {
  const res = await db().update(venues).set({ active }).where(eq(venues.id, venueId)).returning({ id: venues.id });
  return res.length > 0;
}

export async function resetOwnerPassword(email: string, password: string) {
  if (password.length < 8) return false;
  const res = await db()
    .update(users)
    .set({ passwordHash: await hashSecret(password) })
    .where(sql`${users.email} = ${email.trim().toLowerCase()} and ${users.role} = 'owner'`)
    .returning({ id: users.id });
  return res.length > 0;
}

// First start in production: create the platform admin from env if none exists.
export async function ensurePlatformAdmin(email?: string, password?: string) {
  if (!email || !password) return false;
  const [existing] = await db().select({ id: users.id }).from(users).where(eq(users.role, "platform")).limit(1);
  if (existing) return false;
  await db().insert(users).values({ email: email.trim().toLowerCase(), passwordHash: await hashSecret(password), name: "Platform", role: "platform" });
  return true;
}
