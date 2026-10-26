"use client";

import { useEffect, useState, useTransition } from "react";
import { readyAction } from "@/app/actions/kitchen";
import { CheckIcon } from "@/components/icons";
import type { KitchenTicket } from "@/server/kitchen";

const WARN_MIN = 15;
const LATE_MIN = 25;

function minutes(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

export function KitchenScreen({ tickets }: { tickets: KitchenTicket[] }) {
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  // Optimistic: tapped dishes turn ready at once, the refresh confirms.
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const ready = (ids: string[]) => {
    setDone((s) => new Set([...s, ...ids]));
    start(async () => void (await readyAction(ids)));
  };

  if (tickets.length === 0) return <p className="py-24 text-center text-lg text-muted">Заказов нет</p>;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tickets.map((t) => {
        const open = t.items.filter((i) => i.status === "new" && !done.has(i.id));
        const age = open.length ? Math.max(...open.map((i) => minutes(i.sentAt, now))) : 0;
        const tone = open.length === 0 ? "border-line opacity-60" : age >= LATE_MIN ? "border-danger" : age >= WARN_MIN ? "border-warn" : "border-line";
        const timeTone = age >= LATE_MIN ? "bg-danger text-bg" : age >= WARN_MIN ? "bg-warn text-bg" : "bg-surface-2 text-text";
        return (
          <article key={t.orderId} className={`flex flex-col gap-2.5 rounded-[22px] border-2 bg-surface p-4 ${tone}`}>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-2xl font-extrabold">Стол {t.tableNumber}</span>
                <span className="text-xs text-muted">{t.waiterName ?? ""}</span>
              </div>
              {open.length > 0 && <span className={`rounded-full px-3 py-1 text-sm font-extrabold ${timeTone}`}>{age} мин</span>}
            </div>
            <ul className="flex flex-col gap-2">
              {t.items.map((i) => {
                const isReady = i.status === "ready" || done.has(i.id);
                return (
                  <li key={i.id}>
                    <button type="button" disabled={isReady || pending} onClick={() => ready([i.id])}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left ${isReady ? "bg-ok/10 text-ok" : "bg-surface-2 active:scale-[0.99]"}`}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={`text-lg font-bold leading-snug ${isReady ? "line-through decoration-2" : ""}`}>
                          {i.qty > 1 && <span className="text-accent">{i.qty} × </span>}
                          {i.name}
                        </span>
                        {i.comment && <span className="text-sm font-semibold text-warn">{i.comment}</span>}
                        {!isReady && <span className="text-xs text-muted">{minutes(i.sentAt, now)} мин</span>}
                      </span>
                      {isReady ? <CheckIcon size={22} /> : <span className="rounded-xl bg-ok px-3 py-2 text-sm font-extrabold text-bg">Готово</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {open.length > 1 && (
              <button type="button" disabled={pending} onClick={() => ready(open.map((i) => i.id))}
                className="h-12 rounded-2xl border border-ok/50 font-bold text-ok disabled:opacity-50">
                Всё готово
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
