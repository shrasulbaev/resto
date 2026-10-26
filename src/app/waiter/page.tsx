import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { LogoutButton } from "@/components/logout-button";
import { CallCard } from "@/components/waiter/call-card";
import { formatSom } from "@/lib/i18n";
import { requireStaff } from "@/server/session";
import { staffWithVenue } from "@/server/staff";
import { waiterBoard, type BoardTable } from "@/server/waiter";

export const dynamic = "force-dynamic";
export const metadata = { title: "Официант — resto" };

export default async function WaiterHome({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requireStaff("waiter");
  const [me, board] = await Promise.all([staffWithVenue(s.venueId, s.staffId), waiterBoard(s.venueId, s.staffId)]);
  if (!me || !board) return null;
  const tab = (await searchParams).tab === "tables" ? "tables" : "calls";
  const myTables = board.tables.filter((t) => t.mine);
  const ready = myTables.reduce((n, t) => n + t.readyCount, 0);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pb-10 pt-4">
      <LiveRefresh alertOn={["call", "item_ready", "alert"]} />
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xl font-extrabold">{me.name}</span>
          <span className="text-sm text-muted">{me.venueName} · {board.mode === "assigned" ? "закреплённые столы" : "любые столы"}</span>
        </div>
        <LogoutButton />
      </header>

      <nav className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1">
        <Tab href="/waiter" active={tab === "calls"}>
          Вызовы{board.calls.length > 0 && <Badge>{board.calls.length}</Badge>}
        </Tab>
        <Tab href="/waiter?tab=tables" active={tab === "tables"}>
          Столы{ready > 0 && <Badge tone="ok">{ready}</Badge>}
        </Tab>
      </nav>

      {tab === "calls" ? (
        <section className="flex flex-col gap-3">
          {ready > 0 && (
            <div className="rounded-2xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm font-semibold text-ok">
              Готово к выдаче: {myTables.filter((t) => t.readyCount > 0).map((t) => `стол ${t.number} (${t.readyCount})`).join(", ")}
            </div>
          )}
          {board.calls.length === 0 && <p className="py-16 text-center text-muted">Новых вызовов нет</p>}
          {board.calls.map((c) => <CallCard key={c.id} call={c} />)}
        </section>
      ) : (
        <section className="grid grid-cols-3 gap-2.5">
          {board.tables.map((t) => <TableTile key={t.id} t={t} hasCall={board.calls.some((c) => c.tableId === t.id)} />)}
        </section>
      )}
    </main>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`flex h-11 items-center justify-center gap-2 rounded-xl font-bold ${active ? "bg-surface-2 text-text" : "text-muted"}`}>
      {children}
    </Link>
  );
}

function Badge({ children, tone = "accent" }: { children: React.ReactNode; tone?: "accent" | "ok" }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${tone === "ok" ? "bg-ok text-bg" : "bg-accent text-accent-ink"}`}>{children}</span>
  );
}

function TableTile({ t, hasCall }: { t: BoardTable; hasCall: boolean }) {
  const tone =
    t.status === "open" ? (t.mine ? "border-accent/70 bg-accent/10" : "border-line bg-surface")
    : t.status === "pending" ? "border-warn/60 bg-warn/10"
    : "border-transparent bg-surface/50 text-muted";
  return (
    <Link href={`/waiter/t/${t.id}`} className={`relative flex aspect-square flex-col justify-between rounded-2xl border p-3 ${tone}`}>
      <span className="text-2xl font-extrabold">{t.number}</span>
      <span className="text-xs leading-tight">
        {t.status === "closed" ? "свободен" : t.status === "pending" ? "зовут" : t.mine ? "мой" : t.waiterName ?? "открыт"}
        {t.total > 0 && <span className="block font-bold text-text">{formatSom(t.total)}</span>}
      </span>
      {(hasCall || t.readyCount > 0) && (
        <span className={`absolute right-2 top-2 h-3 w-3 rounded-full ${t.readyCount > 0 ? "bg-ok" : "bg-accent"}`} />
      )}
      {t.assignedToMe && <span className="absolute right-2 bottom-2 text-[10px] font-bold text-accent">★</span>}
    </Link>
  );
}
