"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  acceptCallAction, addItemsAction, cancelItemAction, closeBillAction, completeCallAction, importSelectionAction,
  openTableAction, sendToKitchenAction, servedAction, setItemQtyAction,
} from "@/app/actions/waiter";
import { BackIcon, CheckIcon, CloseIcon, MinusIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { formatSom } from "@/lib/i18n";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import type { BoardCall } from "@/server/waiter";
import { callTitle, minutesAgo } from "./call-card";

export type PickerDish = { id: string; name: string; price: number; category: string; self: boolean };
type Item = { id: string; name: string; price: number; qty: number; comment: string | null; status: "new" | "ready" | "served" | "cancelled"; sent: boolean };
type Visit = { id: string; status: "closed" | "pending" | "open"; mine: boolean; waiterName: string | null };
type TableCall = BoardCall & { selectionNames: string[] };

export function WaiterTableScreen({
  table, visit, calls, items, total, dishes,
}: {
  table: { id: string; number: number };
  visit: Visit | null;
  calls: TableCall[];
  items: Item[];
  total: number;
  dishes: PickerDish[];
}) {
  const [pending, start] = useTransition();
  const [picker, setPicker] = useState(false);
  const [paying, setPaying] = useState(false);
  const run = (fn: () => Promise<unknown>) => start(async () => void (await fn()));

  const drafts = items.filter((i) => !i.sent);
  const cooking = items.filter((i) => i.sent && i.status === "new");
  const ready = items.filter((i) => i.status === "ready");
  const served = items.filter((i) => i.status === "served");
  const selfDishes = dishes.filter((d) => d.self);
  const open = visit?.status === "open";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pb-44 pt-4">
      <header className="flex items-center gap-3">
        <Link href="/waiter?tab=tables" aria-label="Назад" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface">
          <BackIcon />
        </Link>
        <div className="flex flex-1 flex-col">
          <span className="text-2xl font-extrabold">Стол {table.number}</span>
          <span className="text-sm text-muted">
            {!visit ? "свободен" : visit.status === "pending" ? "гость зовёт" : visit.mine ? "ваш стол" : `обслуживает ${visit.waiterName ?? "—"}`}
          </span>
        </div>
        {open && <span className="text-xl font-extrabold">{formatSom(total)}</span>}
      </header>

      {!open && (
        <button type="button" disabled={pending} onClick={() => run(() => openTableAction(table.id))} className={`${btnPrimary} h-14`}>
          {visit?.status === "pending" ? "Принять и открыть стол" : "Открыть стол"}
        </button>
      )}

      {calls.filter((c) => c.status === "new" || c.selectionNames.length > 0).map((c) => (
        <article key={c.id} className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
          <div className="flex flex-col">
            <span className="text-lg font-extrabold">{callTitle(c)}</span>
            <span className="text-xs text-muted">{minutesAgo(c.createdAt)}{c.status === "accepted" ? " · принят" : ""}</span>
          </div>
          {c.selectionNames.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-2xl bg-surface-2 px-3.5 py-2.5 text-sm">
              <li className="text-xs font-bold uppercase tracking-wide text-muted">Выбор гостя</li>
              {c.selectionNames.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
          <div className="flex gap-2">
            {c.type === "waiter" && c.status === "new" && (
              <button type="button" disabled={pending} onClick={() => run(() => acceptCallAction(c.id))} className={`${btnPrimary} flex-1`}>Принять</button>
            )}
            {c.selectionNames.length > 0 && (
              <button type="button" disabled={pending} onClick={() => run(() => importSelectionAction(c.id))} className={`${btnSecondary} flex-1`}>В заказ</button>
            )}
            {c.type !== "waiter" && (
              <button type="button" disabled={pending} onClick={() => run(() => completeCallAction(c.id))} className="h-12 flex-1 rounded-2xl bg-ok font-extrabold text-bg disabled:opacity-50">
                Выполнено
              </button>
            )}
          </div>
        </article>
      ))}

      {open && (
        <>
          {ready.length > 0 && (
            <Section title="Готово — отнести" tone="ok">
              {ready.map((i) => (
                <Row key={i.id} item={i}>
                  <button type="button" disabled={pending} onClick={() => run(() => servedAction(i.id))}
                    className="flex h-10 items-center gap-1.5 rounded-xl bg-ok px-3 text-sm font-extrabold text-bg disabled:opacity-50">
                    <CheckIcon size={16} /> Подано
                  </button>
                </Row>
              ))}
            </Section>
          )}

          {drafts.length > 0 && (
            <Section title="Новый заказ — ещё не на кухне" tone="accent">
              {drafts.map((i) => (
                <Row key={i.id} item={i}>
                  <div className="flex items-center gap-0.5 rounded-xl bg-surface-2 p-0.5">
                    <button type="button" aria-label="Меньше" disabled={pending} onClick={() => run(() => setItemQtyAction(i.id, i.qty - 1))} className="flex h-9 w-8 items-center justify-center"><MinusIcon size={16} /></button>
                    <span className="w-5 text-center font-extrabold">{i.qty}</span>
                    <button type="button" aria-label="Больше" disabled={pending} onClick={() => run(() => setItemQtyAction(i.id, i.qty + 1))} className="flex h-9 w-8 items-center justify-center"><PlusIcon size={16} /></button>
                  </div>
                </Row>
              ))}
            </Section>
          )}

          {cooking.length > 0 && (
            <Section title="Готовится">
              {cooking.map((i) => (
                <Row key={i.id} item={i}>
                  <button type="button" disabled={pending} onClick={() => confirm(`Отменить «${i.name}»?`) && run(() => cancelItemAction(i.id))}
                    className="h-10 rounded-xl px-3 text-sm font-semibold text-muted">Отменить</button>
                </Row>
              ))}
            </Section>
          )}

          {served.length > 0 && (
            <Section title="Подано">
              {served.map((i) => <Row key={i.id} item={i} muted />)}
            </Section>
          )}

          {items.length === 0 && <p className="py-8 text-center text-muted">Заказ пуст. Добавьте блюда.</p>}

          {selfDishes.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted">Гость взял сам</span>
              <div className="flex flex-wrap gap-2">
                {selfDishes.map((d) => (
                  <button key={d.id} type="button" disabled={pending} onClick={() => run(() => addItemsAction(visit!.id, [{ dishId: d.id, qty: 1 }], true))}
                    className="h-10 rounded-full border border-line bg-surface px-3.5 text-sm font-bold disabled:opacity-50">
                    + {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md flex-col gap-2 border-t border-line bg-bg/95 px-4 pb-5 pt-3 backdrop-blur">
            <div className="flex gap-2">
              <button type="button" onClick={() => setPicker(true)} className={`${btnSecondary} h-14 flex-1`}>
                <PlusIcon size={18} /> Блюда
              </button>
              <button type="button" disabled={pending || drafts.length === 0} onClick={() => run(() => sendToKitchenAction(visit!.id))}
                className={`${btnPrimary} h-14 flex-[1.4]`}>
                На кухню{drafts.length > 0 ? ` · ${drafts.reduce((s, i) => s + i.qty, 0)}` : ""}
              </button>
            </div>
            <button type="button" onClick={() => setPaying(true)} className="h-12 rounded-2xl border border-line font-bold">
              Закрыть счёт · {formatSom(total)}
            </button>
          </div>
        </>
      )}

      {picker && visit && <Picker dishes={dishes} onClose={() => setPicker(false)} onAdd={(list) => run(async () => { await addItemsAction(visit.id, list); setPicker(false); })} pending={pending} />}
      {paying && visit && <PaySheet total={total} drafts={drafts.length} onClose={() => setPaying(false)} pending={pending} onPay={(m) => run(async () => { await closeBillAction(visit.id, m); setPaying(false); })} />}
    </main>
  );
}

function Section({ title, tone, children }: { title: string; tone?: "ok" | "accent"; children: React.ReactNode }) {
  const color = tone === "ok" ? "text-ok" : tone === "accent" ? "text-accent" : "text-muted";
  return (
    <section className="flex flex-col gap-2">
      <span className={`text-xs font-bold uppercase tracking-wide ${color}`}>{title}</span>
      {children}
    </section>
  );
}

function Row({ item, children, muted }: { item: Item; children?: React.ReactNode; muted?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl bg-surface px-3.5 py-2.5 ${muted ? "opacity-60" : ""}`}>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-bold">{item.qty > 1 && item.sent ? `${item.qty} × ` : ""}{item.name}</span>
        <span className="truncate text-xs text-muted">{formatSom(item.price * item.qty)}{item.comment ? ` · ${item.comment}` : ""}</span>
      </div>
      {children}
    </div>
  );
}

function Picker({ dishes, onAdd, onClose, pending }: { dishes: PickerDish[]; onAdd: (l: { dishId: string; qty: number; comment?: string }[]) => void; onClose: () => void; pending: boolean }) {
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const query = q.trim().toLowerCase();
  const groups = useMemo(() => {
    const list = query ? dishes.filter((d) => d.name.toLowerCase().includes(query)) : dishes;
    const map = new Map<string, PickerDish[]>();
    for (const d of list) map.set(d.category, [...(map.get(d.category) ?? []), d]);
    return [...map.entries()];
  }, [dishes, query]);
  const count = Object.values(cart).reduce((s, n) => s + n, 0);
  const sum = dishes.reduce((s, d) => s + (cart[d.id] ?? 0) * d.price, 0);
  const bump = (id: string, by: number) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + by) }));

  return (
    <div role="dialog" aria-modal="true" aria-label="Добавить блюда" className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-bg">
      <div className="flex items-center gap-3 px-4 pb-2 pt-4">
        <button type="button" aria-label="Закрыть" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface"><CloseIcon size={18} /></button>
        <label className="flex h-11 flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-3">
          <SearchIcon size={18} className="text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск блюда" aria-label="Поиск блюда" className="flex-1 bg-transparent outline-none placeholder:text-muted" />
        </label>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-32 pt-2">
        {groups.map(([cat, list]) => (
          <section key={cat} className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">{cat}</span>
            {list.map((d) => {
              const n = cart[d.id] ?? 0;
              return (
                <div key={d.id} className={`flex flex-col gap-2 rounded-2xl px-3.5 py-2.5 ${n ? "bg-surface-2" : "bg-surface"}`}>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => bump(d.id, 1)} className="flex min-w-0 flex-1 flex-col text-left">
                      <span className="truncate font-bold">{d.name}</span>
                      <span className="text-xs text-muted">{formatSom(d.price)}</span>
                    </button>
                    {n > 0 && (
                      <button type="button" aria-label="Меньше" onClick={() => bump(d.id, -1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface"><MinusIcon size={16} /></button>
                    )}
                    {n > 0 && <span className="w-5 text-center font-extrabold">{n}</span>}
                    <button type="button" aria-label="Больше" onClick={() => bump(d.id, 1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-ink"><PlusIcon size={18} /></button>
                  </div>
                  {n > 0 && (
                    <input value={notes[d.id] ?? ""} onChange={(e) => setNotes((x) => ({ ...x, [d.id]: e.target.value }))} maxLength={120}
                      placeholder="Комментарий для кухни" aria-label={`Комментарий: ${d.name}`}
                      className="h-10 rounded-xl border border-line bg-bg px-3 text-sm outline-none placeholder:text-muted focus:border-accent" />
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-line bg-bg px-4 pb-5 pt-3">
        <button type="button" disabled={pending || count === 0}
          onClick={() => onAdd(Object.entries(cart).filter(([, n]) => n > 0).map(([dishId, qty]) => ({ dishId, qty, comment: notes[dishId] || undefined })))}
          className={`${btnPrimary} h-14 w-full`}>
          Добавить {count > 0 ? `${count} поз. · ${formatSom(sum)}` : ""}
        </button>
      </div>
    </div>
  );
}

function PaySheet({ total, drafts, onPay, onClose, pending }: { total: number; drafts: number; onPay: (m: "cash" | "card") => void; onClose: () => void; pending: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Закрыть счёт" onClick={(e) => e.stopPropagation()}
        className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-t-[26px] bg-surface px-5 pb-7 pt-5">
        <span className="text-lg font-extrabold">Закрыть счёт</span>
        <span className="text-4xl font-extrabold">{formatSom(total)}</span>
        <p className="text-sm text-muted">
          После оплаты стол закроется, у гостей останется только меню.
          {drafts > 0 && " Блюда, не отправленные на кухню, в счёт не попадут."}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" disabled={pending} onClick={() => onPay("cash")} className={`${btnPrimary} h-14`}>Наличные</button>
          <button type="button" disabled={pending} onClick={() => onPay("card")} className={`${btnPrimary} h-14`}>Карта</button>
        </div>
        <button type="button" onClick={onClose} className="h-11 font-semibold text-muted">Отмена</button>
      </div>
    </div>
  );
}
