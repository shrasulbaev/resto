import { LogoutButton } from "@/components/logout-button";
import { AdminNav } from "@/components/admin/admin-nav";
import { PushToggle } from "@/components/push-toggle";
import { env } from "@/lib/env";
import { db } from "@/db/client";
import { venues } from "@/db/schema";
import { requireOwner } from "@/server/session";
import { eq } from "drizzle-orm";

export const metadata = { title: "Админка — resto" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireOwner();
  const [venue] = await db().select({ name: venues.name }).from(venues).where(eq(venues.id, s.venueId));
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-5 px-4 pb-16 pt-4 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Админка</span>
          <span className="text-xl font-extrabold">{venue?.name}</span>
        </div>
        <LogoutButton />
      </header>
      <PushToggle publicKey={env().VAPID_PUBLIC_KEY ?? null} />
      <AdminNav />
      {children}
    </div>
  );
}
