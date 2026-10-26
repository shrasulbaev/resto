import { eq } from "drizzle-orm";
import { BrandingForm } from "@/components/admin/branding-form";
import { db } from "@/db/client";
import { tables, venues } from "@/db/schema";
import { requireOwner } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AdminBrandingPage() {
  const s = await requireOwner();
  const [v] = await db().select().from(venues).where(eq(venues.id, s.venueId));
  const [t] = await db().select({ token: tables.token }).from(tables).where(eq(tables.venueId, s.venueId)).limit(1);
  return (
    <BrandingForm
      venueName={v.name}
      previewUrl={t ? `/t/${t.token}` : null}
      initial={{ logoUrl: v.logoUrl, backgroundUrl: v.backgroundUrl, backgroundDim: v.backgroundDim }}
    />
  );
}
