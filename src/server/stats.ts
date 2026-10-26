import { sql } from "drizzle-orm";
import { db } from "@/db/client";

// Owner statistics over closed bills. All grouping happens in the venue's
// timezone so "today" and hours match the wall clock in the hall.

export type Period = "today" | "7d" | "30d";

export function periodStart(period: Period, tz: string, now = new Date()) {
  // Local midnight of today (or N-1 days back) converted to an instant.
  const days = period === "today" ? 0 : period === "7d" ? 6 : 29;
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return { localDate: local, days };
}

type Row = Record<string, unknown>;
const rows = async <T extends Row>(q: ReturnType<typeof sql>) => (await db().execute<T>(q)).rows;
const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export async function venueStats(venueId: string, tz: string, period: Period, now = new Date()) {
  const { localDate, days } = periodStart(period, tz, now);
  // [from, to) as timestamptz computed by Postgres from the local date.
  const from = sql`((${localDate}::date - ${days}::int)::timestamp at time zone ${tz})`;
  const to = sql`(${now.toISOString()}::timestamptz)`;

  const [summary] = await rows<{ checks: string; revenue: string; cash: string; card: string }>(sql`
    select count(*) as checks, coalesce(sum(total),0) as revenue,
      coalesce(sum(total) filter (where payment = 'cash'),0) as cash,
      coalesce(sum(total) filter (where payment = 'card'),0) as card
    from orders where venue_id = ${venueId} and status = 'closed' and closed_at >= ${from} and closed_at < ${to}`);

  const topDishes = await rows<{ name: string; qty: string; revenue: string }>(sql`
    select oi.name, sum(oi.qty) as qty, sum(oi.qty * oi.price) as revenue
    from order_items oi join orders o on o.id = oi.order_id
    where o.venue_id = ${venueId} and o.status = 'closed' and o.closed_at >= ${from} and o.closed_at < ${to} and oi.status <> 'cancelled'
    group by oi.name order by qty desc, revenue desc limit 10`);

  // Guests per hour: when tables were opened, in local hours.
  const hourly = await rows<{ hour: string; visits: string }>(sql`
    select extract(hour from created_at at time zone ${tz})::int as hour, count(*) as visits
    from table_visits where venue_id = ${venueId} and created_at >= ${from} and created_at < ${to}
    group by 1 order by 1`);

  const [reaction] = await rows<{ avg_sec: string; calls: string; no_response: string }>(sql`
    select
      (select avg(extract(epoch from accepted_at - created_at)) from calls
        where venue_id = ${venueId} and type = 'waiter' and accepted_at is not null and created_at >= ${from} and created_at < ${to}) as avg_sec,
      (select count(*) from calls where venue_id = ${venueId} and created_at >= ${from} and created_at < ${to}) as calls,
      (select count(*) from table_visits where venue_id = ${venueId} and close_reason = 'no_response' and closed_at >= ${from} and closed_at < ${to}) as no_response`);

  const [kitchen] = await rows<{ avg_sec: string }>(sql`
    select avg(extract(epoch from ready_at - sent_at)) as avg_sec from order_items
    where venue_id = ${venueId} and ready_at is not null and sent_at >= ${from} and sent_at < ${to}`);

  const waiters = await rows<{ name: string; checks: string; revenue: string }>(sql`
    select coalesce(s.name, '—') as name, count(*) as checks, sum(o.total) as revenue
    from orders o left join staff s on s.id = o.waiter_id
    where o.venue_id = ${venueId} and o.status = 'closed' and o.closed_at >= ${from} and o.closed_at < ${to}
    group by s.name order by revenue desc`);

  // "My selection" adds vs dishes actually ordered: shows what tempts but does not sell.
  const interest = await rows<{ name: string; added: string; ordered: string }>(sql`
    with i as (
      select dish_id, count(*) as added from dish_interest
      where venue_id = ${venueId} and created_at >= ${from} and created_at < ${to} group by dish_id
    ), o as (
      select oi.dish_id, sum(oi.qty) as ordered from order_items oi join orders o on o.id = oi.order_id
      where o.venue_id = ${venueId} and o.status = 'closed' and o.closed_at >= ${from} and o.closed_at < ${to} and oi.status <> 'cancelled'
      group by oi.dish_id
    )
    select d.name_ru as name, i.added, coalesce(o.ordered, 0) as ordered
    from i join dishes d on d.id = i.dish_id left join o on o.dish_id = i.dish_id
    order by i.added desc limit 10`);

  const bills = await rows<{ id: string; closed_at: Date; table_number: string; waiter: string | null; total: string; payment: string | null; items: string }>(sql`
    select o.id, o.closed_at, t.number as table_number, s.name as waiter, o.total, o.payment,
      (select coalesce(sum(qty),0) from order_items where order_id = o.id and status <> 'cancelled') as items
    from orders o join tables t on t.id = o.table_id left join staff s on s.id = o.waiter_id
    where o.venue_id = ${venueId} and o.status = 'closed' and o.closed_at >= ${from} and o.closed_at < ${to}
    order by o.closed_at desc limit 50`);

  const checks = n(summary.checks);
  const revenue = n(summary.revenue);
  return {
    checks,
    revenue,
    avgCheck: checks ? Math.round(revenue / checks) : 0,
    cash: n(summary.cash),
    card: n(summary.card),
    topDishes: topDishes.map((r) => ({ name: r.name, qty: n(r.qty), revenue: n(r.revenue) })),
    hourly: Array.from({ length: 24 }, (_, h) => n(hourly.find((r) => n(r.hour) === h)?.visits)),
    reactionSec: reaction.avg_sec === null ? null : Math.round(n(reaction.avg_sec)),
    calls: n(reaction.calls),
    noResponse: n(reaction.no_response),
    kitchenSec: kitchen.avg_sec === null ? null : Math.round(n(kitchen.avg_sec)),
    waiters: waiters.map((w) => ({ name: w.name, checks: n(w.checks), revenue: n(w.revenue) })),
    interest: interest.map((r) => ({ name: r.name, added: n(r.added), ordered: n(r.ordered) })),
    bills: bills.map((b) => ({
      id: b.id,
      closedAt: new Date(b.closed_at).toISOString(),
      table: n(b.table_number),
      waiter: b.waiter,
      total: n(b.total),
      payment: b.payment as "cash" | "card" | null,
      items: n(b.items),
    })),
  };
}

export type VenueStats = Awaited<ReturnType<typeof venueStats>>;
