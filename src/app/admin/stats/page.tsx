import { eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db/client";
import { venues } from "@/db/schema";
import { formatSom } from "@/lib/i18n";
import { requireOwner } from "@/server/session";
import { venueStats, type Period } from "@/server/stats";

export const dynamic = "force-dynamic";

const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Сегодня" },
  { id: "7d", label: "7 дней" },
  { id: "30d", label: "30 дней" },
];

function duration(sec: number | null) {
  if (sec === null) return "—";
  if (sec < 60) return `${sec} с`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} мин ${s} с` : `${m} мин`;
}

export default async function AdminStatsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const s = await requireOwner();
  const p = (await searchParams).p;
  const period: Period = p === "7d" || p === "30d" ? p : "today";
  const [v] = await db().select().from(venues).where(eq(venues.id, s.venueId));
  const st = await venueStats(s.venueId, v.timezone, period);
  const maxHour = Math.max(1, ...st.hourly);
  const maxDish = Math.max(1, ...st.topDishes.map((d) => d.qty));
  const fmtTime = new Intl.DateTimeFormat("ru-RU", { timeZone: v.timezone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex gap-1 self-start rounded-full bg-surface p-1">
        {PERIODS.map((x) => (
          <Link key={x.id} href={`/admin/stats?p=${x.id}`}
            className={`flex h-9 items-center rounded-full px-4 text-sm font-bold ${x.id === period ? "bg-surface-2 text-text" : "text-muted"}`}>
            {x.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Выручка" value={formatSom(st.revenue)} />
        <Tile label="Счетов" value={String(st.checks)} />
        <Tile label="Средний чек" value={formatSom(st.avgCheck)} />
        <Tile label="Наличные / карта" value={`${formatSom(st.cash)}`} sub={`карта ${formatSom(st.card)}`} />
        <Tile label="Официант подходит за" value={duration(st.reactionSec)} sub={`вызовов: ${st.calls}`} />
        <Tile label="Кухня готовит за" value={duration(st.kitchenSec)} sub="в среднем на блюдо" />
        <Tile label="Без ответа" value={String(st.noResponse)} sub="столы закрылись, никто не подошёл" warn={st.noResponse > 0} />
      </div>

      <Card title="Гости по часам" hint="Сколько раз открывали столы в каждый час">
        {st.hourly.every((x) => x === 0) ? <Empty /> : (
          <div className="flex flex-col gap-1">
            <div className="flex h-40 items-end gap-[2px]" role="img" aria-label="Открытия столов по часам">
              {st.hourly.map((x, h) => (
                <div key={h} className="group relative flex h-full flex-1 items-end">
                  <div className="w-full rounded-t-[4px] bg-accent transition group-hover:brightness-125" style={{ height: `${(x / maxHour) * 100}%`, minHeight: x ? 3 : 0 }} />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-text px-2 py-1 text-xs font-bold text-bg group-hover:block">
                    {String(h).padStart(2, "0")}:00 · {x}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-[2px] border-t border-line pt-1 text-[10px] text-muted">
              {st.hourly.map((_, h) => <span key={h} className="flex-1 text-center">{h % 3 === 0 ? h : ""}</span>)}
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Топ блюд" hint="По количеству в закрытых счетах">
          {st.topDishes.length === 0 ? <Empty /> : (
            <ul className="flex flex-col gap-2.5">
              {st.topDishes.map((d) => (
                <li key={d.name} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate font-semibold">{d.name}</span>
                    <span className="shrink-0 text-muted">{d.qty} шт · {formatSom(d.revenue)}</span>
                  </div>
                  <div className="h-2 rounded-r-[4px] bg-accent" style={{ width: `${(d.qty / maxDish) * 100}%` }} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Смотрят, но не заказывают" hint="Сколько раз блюдо добавляли в «Мой выбор» и сколько заказали">
          {st.interest.length === 0 ? <Empty /> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr><th className="pb-2 font-semibold">Блюдо</th><th className="pb-2 text-right font-semibold">В выбор</th><th className="pb-2 text-right font-semibold">Заказали</th></tr>
              </thead>
              <tbody>
                {st.interest.map((r) => (
                  <tr key={r.name} className="border-t border-line">
                    <td className="py-2 font-semibold">{r.name}</td>
                    <td className="py-2 text-right">{r.added}</td>
                    <td className={`py-2 text-right ${r.ordered < r.added / 2 ? "text-warn" : ""}`}>{r.ordered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Официанты">
        {st.waiters.length === 0 ? <Empty /> : (
          <table className="w-full text-sm">
            <tbody>
              {st.waiters.map((w) => (
                <tr key={w.name} className="border-t border-line first:border-0">
                  <td className="py-2 font-semibold">{w.name}</td>
                  <td className="py-2 text-right text-muted">{w.checks} сч.</td>
                  <td className="py-2 text-right font-bold">{formatSom(w.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Закрытые счета" hint="Сумму вносит официант при закрытии счёта">
        {st.bills.length === 0 ? <Empty /> : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="pb-2 font-semibold">Закрыт</th><th className="pb-2 font-semibold">Стол</th><th className="pb-2 font-semibold">Официант</th>
                  <th className="pb-2 text-right font-semibold">Позиций</th><th className="pb-2 font-semibold">Оплата</th><th className="pb-2 text-right font-semibold">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {st.bills.map((b) => (
                  <tr key={b.id} className="border-t border-line">
                    <td className="py-2 text-muted">{fmtTime.format(new Date(b.closedAt))}</td>
                    <td className="py-2 font-semibold">{b.table}</td>
                    <td className="py-2">{b.waiter ?? "—"}</td>
                    <td className="py-2 text-right">{b.items}</td>
                    <td className="py-2">{b.payment === "card" ? "карта" : b.payment === "cash" ? "наличные" : "—"}</td>
                    <td className="py-2 text-right font-bold">{formatSom(b.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Tile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface p-4">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className={`text-2xl font-extrabold ${warn ? "text-warn" : ""}`}>{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <div className="flex flex-col">
        <h2 className="text-lg font-extrabold">{title}</h2>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="py-6 text-center text-sm text-muted">Пока нет данных за этот период</p>;
}
