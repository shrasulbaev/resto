import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { venues } from "@/db/schema";
import { venueStaffForLogin } from "@/server/auth";
import { PinLogin } from "./pin-login";

export const dynamic = "force-dynamic";

export default async function StaffLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [venue] = await db().select().from(venues).where(eq(venues.slug, slug));
  if (!venue || !venue.active) notFound();
  const people = await venueStaffForLogin(slug);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted">{venue.name}</span>
        <h1 className="text-3xl font-extrabold">Кто на смене?</h1>
      </div>
      <PinLogin slug={slug} people={people} />
    </main>
  );
}
