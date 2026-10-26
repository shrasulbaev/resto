import { eq } from "drizzle-orm";
import { StaffEditor } from "@/components/admin/staff-editor";
import { db } from "@/db/client";
import { venues } from "@/db/schema";
import { env } from "@/lib/env";
import { adminStaff, adminTables } from "@/server/admin-venue";
import { requireOwner } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const s = await requireOwner();
  const [[venue], people, tableList] = await Promise.all([
    db().select().from(venues).where(eq(venues.id, s.venueId)),
    adminStaff(s.venueId),
    adminTables(s.venueId),
  ]);
  return (
    <StaffEditor
      loginUrl={`${env().APP_URL.replace(/\/$/, "")}/s/${venue.slug}`}
      slug={venue.slug}
      mode={venue.assignmentMode}
      staff={people}
      tables={tableList.map((t) => ({ id: t.id, number: t.number, waiterIds: t.waiterIds }))}
    />
  );
}
