import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { staff, venues } from "@/db/schema";

export async function staffWithVenue(venueId: string, staffId: string) {
  const [row] = await db()
    .select({ name: staff.name, venueName: venues.name, slug: venues.slug })
    .from(staff)
    .innerJoin(venues, eq(venues.id, staff.venueId))
    .where(and(eq(staff.id, staffId), eq(staff.venueId, venueId)));
  return row ?? null;
}
