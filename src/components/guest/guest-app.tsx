"use client";

import { useEffect, useMemo, useState } from "react";
import { BackIcon, FlameIcon, MinusIcon, PlusIcon } from "@/components/icons";
import { formatSom, t } from "@/lib/i18n";
import { addDish, parseSelection, setQty, totals, type SelectionItem } from "@/lib/selection";
import { btnPrimary } from "@/lib/ui";
import { DishPhoto } from "./dish-photo";
import { GuestMenu } from "./guest-menu";
import type { GuestDish, GuestMenuData } from "./types";

const NORM_KEY = "resto:kcal-norm";
export const SELECTION_RESET = "resto:selection-reset";

export type SelectionApi = {
  items: SelectionItem[];
  clear: () => void;
  totals: { count: number; sum: number; kcal: number };
};

// Wraps the menu with "My selection". `actions` renders the call buttons
// (bar = bottom bar of the menu, sheet = inside the selection screen).
export function GuestApp({
  data,
  actions,
}: {
  data: GuestMenuData;
  actions?: (place: "bar" | "sheet", selection: SelectionApi) => React.ReactNode;
}) {
  const d = t(data.lang);
  const key = `resto:sel:${data.tableToken}`;
  const [items, setItems] = useState<SelectionItem[]>([]);
  const [norm, setNorm] = useState<number | null>(null);
  const [showSelection, setShowSelection] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      setItems(parseSelection(localStorage.getItem(key)));
      const n = Number(localStorage.getItem(NORM_KEY));
      setNorm(n > 0 ? n : null);
    } catch {}
  }, [key]);

  useEffect(() => {
    const reset = () => setItems([]);
    window.addEventListener(SELECTION_RESET, reset);
    return () => window.removeEventListener(SELECTION_RESET, reset);
  }, []);

  const save = (next: SelectionItem[]) => {
    setItems(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };

  const byId = useMemo(() => new Map(data.dishes.map((x) => [x.id, x])), [data.dishes]);
  const sum = totals(items, byId);
  const api: SelectionApi = { items, totals: sum, clear: () => save([]) };

  const add = (dish: GuestDish, qty = 1, comment?: string) => {
    save(addDish(items, dish.id, qty, comment));
    setToast(`${d.added}: ${dish.name}`);
    setTimeout(() => setToast(null), 1800);
    fetch(`/api/t/${data.tableToken}/interest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dishId: dish.id }),
    }).catch(() => {});
  };

  const saveNorm = (n: number | null) => {
    setNorm(n);
    try {
      if (n) localStorage.setItem(NORM_KEY, String(n));
      else localStorage.removeItem(NORM_KEY);
    } catch {}
  };

  return (
    <>
      <GuestMenu
        data={data}
        onAdd={(dish) => add(dish)}
        sheetFooter={(dish, close) => <AddForm dish={dish} lang={data.lang} onAdd={(q, c) => { add(dish, q, c); close(); }} />}
        bottomBar={
          <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-3 pb-4">
            <div className="flex gap-2 rounded-[22px] border border-line bg-surface/95 p-2 shadow-[0_12px_32px_rgba(0,0,0,0.5)] backdrop-blur">
              <button type="button" onClick={() => setShowSelection(true)}
                className="flex min-w-0 flex-1 flex-col justify-center rounded-2xl bg-surface-2 px-3 text-left">
                <span className="text-xs text-muted">{d.mySelection} · {sum.count}</span>
                <span className="truncate text-[15px] font-extrabold">{formatSom(sum.sum)} · {sum.kcal} {d.kcal}</span>
              </button>
              {actions?.("bar", api)}
            </div>
          </div>
        }
      />

      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-28 z-50 mx-auto w-fit max-w-[90%] rounded-full bg-text px-4 py-2 text-sm font-bold text-bg">
          {toast}
        </div>
      )}

      {showSelection && (
        <div role="dialog" aria-modal="true" aria-label={d.mySelection} className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-bg">
          <div className="flex items-center gap-3 px-5 pb-2.5 pt-4">
            <button type="button" aria-label={d.close} onClick={() => setShowSelection(false)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface">
              <BackIcon />
            </button>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold">{d.mySelection}</span>
              <span className="text-sm text-muted">{d.table} {data.tableNumber} · {d.notAnOrder}</span>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 pt-3">
            {items.length === 0 && <p className="py-10 text-center text-muted">{d.emptySelection}</p>}
            {items.map((it, i) => {
              const dish = byId.get(it.dishId);
              if (!dish) return null;
              return (
                <div key={`${it.dishId}-${it.comment ?? ""}`} className="flex items-center gap-3 rounded-2xl bg-surface p-2.5">
                  <DishPhoto url={dish.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-bold">{dish.name}</span>
                    <span className="truncate text-xs text-muted">
                      {formatSom(dish.price)}{dish.kcal !== null ? ` · ${dish.kcal} ${d.kcal}` : ""}{it.comment ? ` · ${it.comment}` : ""}
                    </span>
                  </div>
                  <Stepper lang={data.lang} value={it.qty} onChange={(q) => save(setQty(items, i, q))} />
                </div>
              );
            })}
            {items.length > 0 && (
              <>
                <div className="flex justify-between px-1 pt-1.5">
                  <span className="text-muted">{d.total}</span>
                  <span className="text-lg font-extrabold">{formatSom(sum.sum)}</span>
                </div>
                <div className={`flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-sm ${norm && sum.kcal > norm ? "text-text" : "text-muted"}`}>
                  <FlameIcon size={16} className="shrink-0 text-accent" />
                  <span className="flex-1">
                    {sum.kcal} {d.kcal}
                    {norm && sum.kcal > norm ? ` — ${d.kcalWarn} (${norm})` : ""}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    <span className="sr-only">{d.kcalNorm}</span>
                    <select value={norm ?? 0} onChange={(e) => saveNorm(Number(e.target.value) || null)}
                      className="rounded-lg bg-surface px-2 py-1 text-text">
                      <option value={0}>{d.kcalOff}</option>
                      {[600, 800, 1000, 1200, 1500].map((n) => <option key={n} value={n}>≤ {n}</option>)}
                    </select>
                  </label>
                </div>
              </>
            )}
          </div>

          {actions && (
            <div className="flex flex-col gap-2.5 rounded-t-[26px] bg-surface px-5 pb-6 pt-4">{actions("sheet", api)}</div>
          )}
        </div>
      )}
    </>
  );
}

function Stepper({ value, onChange, lang }: { value: number; onChange: (v: number) => void; lang: GuestMenuData["lang"] }) {
  const d = t(lang);
  return (
    <div className="flex items-center gap-0.5 rounded-xl bg-surface-2 p-0.5">
      <button type="button" aria-label={d.less} onClick={() => onChange(value - 1)} className="flex h-9 w-8 items-center justify-center">
        <MinusIcon size={16} />
      </button>
      <span className="w-5 text-center font-extrabold">{value}</span>
      <button type="button" aria-label={d.more} onClick={() => onChange(value + 1)} className="flex h-9 w-8 items-center justify-center">
        <PlusIcon size={16} />
      </button>
    </div>
  );
}

function AddForm({ dish, lang, onAdd }: { dish: GuestDish; lang: GuestMenuData["lang"]; onAdd: (qty: number, comment?: string) => void }) {
  const d = t(lang);
  const [qty, setQ] = useState(1);
  const [comment, setComment] = useState("");
  return (
    <div className="flex flex-col gap-3 pt-1">
      <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={d.commentPlaceholder} maxLength={120}
        aria-label={d.commentPlaceholder}
        className="h-11 rounded-xl border border-line bg-bg px-3.5 text-sm outline-none placeholder:text-muted focus:border-accent" />
      <div className="flex gap-2.5">
        <Stepper lang={lang} value={qty} onChange={(v) => setQ(Math.max(1, v))} />
        <button type="button" onClick={() => onAdd(qty, comment)} className={`${btnPrimary} h-14 flex-1`}>
          {d.addToSelection} · {formatSom(dish.price * qty)}
        </button>
      </div>
    </div>
  );
}
