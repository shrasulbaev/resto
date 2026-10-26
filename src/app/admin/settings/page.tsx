import { eq } from "drizzle-orm";
import { SettingsForm } from "@/components/admin/settings-form";
import { db } from "@/db/client";
import { venues } from "@/db/schema";
import { requireOwner } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const s = await requireOwner();
  const [v] = await db().select().from(venues).where(eq(venues.id, s.venueId));
  return (
    <SettingsForm
      initial={{
        allDay: !v.opensAt || !v.closesAt,
        opensAt: v.opensAt ?? "10:00",
        closesAt: v.closesAt ?? "23:00",
        callPauseMin: String(Math.round(v.callPauseSec / 60)),
        maxPendingCalls: String(v.maxPendingCalls),
        autoCloseHours: String(v.autoCloseHours),
        assignmentMode: v.assignmentMode,
        escalateAfterMin: String(Math.round(v.escalateAfterSec / 60)),
      }}
    />
  );
}
