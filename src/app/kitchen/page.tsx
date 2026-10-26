import { KitchenScreen } from "@/components/kitchen/kitchen-screen";
import { LiveRefresh } from "@/components/live-refresh";
import { LogoutButton } from "@/components/logout-button";
import { kitchenBoard } from "@/server/kitchen";
import { requireStaff } from "@/server/session";
import { staffWithVenue } from "@/server/staff";

export const dynamic = "force-dynamic";
export const metadata = { title: "Кухня — resto" };

export default async function KitchenHome() {
  const s = await requireStaff("kitchen");
  const [me, tickets] = await Promise.all([staffWithVenue(s.venueId, s.staffId), kitchenBoard(s.venueId)]);
  const cooking = tickets.reduce((n, t) => n + t.items.filter((i) => i.status === "new").length, 0);
  return (
    <main className="flex min-h-dvh flex-col gap-4 px-4 pb-8 pt-4 sm:px-6">
      <LiveRefresh alertOn={["order"]} everyMs={30_000} />
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-2xl font-extrabold">Кухня</span>
          <span className="text-sm text-muted">{me?.venueName} · готовится: {cooking}</span>
        </div>
        <LogoutButton />
      </header>
      <KitchenScreen tickets={tickets} />
    </main>
  );
}
