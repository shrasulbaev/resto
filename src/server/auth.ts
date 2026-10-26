import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { staff, users, venues } from "@/db/schema";
import { verifySecret } from "@/lib/passwords";
import type { Session } from "@/lib/session-token";

export async function authenticateUser(email: string, password: string): Promise<Session | null> {
  const [user] = await db()
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()));
  if (!user || !(await verifySecret(password, user.passwordHash))) return null;
  if (user.role === "owner" && !user.venueId) return null;
  return { kind: "user", userId: user.id, role: user.role, venueId: user.venueId };
}

// The staff member must belong to the venue in the URL and be active.
export async function authenticateStaff(venueSlug: string, staffId: string, pin: string): Promise<Session | null> {
  const [row] = await db()
    .select({ staff, venue: venues })
    .from(staff)
    .innerJoin(venues, eq(venues.id, staff.venueId))
    .where(and(eq(staff.id, staffId), eq(venues.slug, venueSlug), eq(staff.active, true), eq(venues.active, true)));
  if (!row?.staff.pinHash || !(await verifySecret(pin, row.staff.pinHash))) return null;
  return { kind: "staff", staffId: row.staff.id, role: row.staff.role, venueId: row.venue.id };
}

export async function venueStaffForLogin(venueSlug: string) {
  return db()
    .select({ id: staff.id, name: staff.name, role: staff.role })
    .from(staff)
    .innerJoin(venues, eq(venues.id, staff.venueId))
    .where(and(eq(venues.slug, venueSlug), eq(staff.active, true), eq(venues.active, true)))
    .orderBy(staff.role, staff.name);
}

// Small in-memory limiter against PIN guessing; per key, sliding window.
const attempts = new Map<string, number[]>();

export function allowAttempt(key: string, limit = 5, windowMs = 60_000, now = Date.now()): boolean {
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    attempts.set(key, recent);
    return false;
  }
  recent.push(now);
  attempts.set(key, recent);
  return true;
}
