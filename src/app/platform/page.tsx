import { LogoutButton } from "@/components/logout-button";
import { PlatformVenues } from "@/components/platform-venues";
import { env } from "@/lib/env";
import { platformVenues } from "@/server/platform";
import { requirePlatform } from "@/server/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Платформа — resto" };

export default async function PlatformHome() {
  await requirePlatform();
  const list = await platformVenues();
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-5 px-4 pb-16 pt-4 sm:px-6">
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Платформа</span>
          <span className="text-xl font-extrabold">Заведения</span>
        </div>
        <LogoutButton />
      </header>
      <PlatformVenues venues={list} appUrl={env().APP_URL.replace(/\/$/, "")} />
    </main>
  );
}
