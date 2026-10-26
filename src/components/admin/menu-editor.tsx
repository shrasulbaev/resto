"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  createCategoryAction, deleteCategoryAction, moveCategoryAction, moveDishAction, renameCategoryAction, setDishFlagAction,
} from "@/app/actions/admin-menu";
import { EditIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { DishPhoto } from "@/components/guest/dish-photo";
import { formatSom } from "@/lib/i18n";
import { btnPrimary, btnSecondary, input } from "@/lib/ui";

type Dish = { id: string; name: string; price: number; photoUrl: string | null; inStock: boolean; hitPinned: boolean; isSignature: boolean; missingKy: boolean };
type Cat = { id: string; nameRu: string; nameKy: string; dishes: Dish[] };

export function MenuEditor({ categories }: { categories: Cat[] }) {
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<"all" | "stop">("all");
  const stopCount = categories.reduce((n, c) => n + c.dishes.filter((d) => !d.inStock).length, 0);
  const run = (fn: () => Promise<unknown>) => start(async () => void (await fn()));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-surface p-1">
          <button type="button" onClick={() => setFilter("all")} className={`h-9 rounded-full px-4 text-sm font-bold ${filter === "all" ? "bg-surface-2" : "text-muted"}`}>Все блюда</button>
          <button type="button" onClick={() => setFilter("stop")} className={`h-9 rounded-full px-4 text-sm font-bold ${filter === "stop" ? "bg-surface-2" : "text-muted"}`}>
            Стоп-лист{stopCount > 0 && <span className="ml-1.5 rounded-full bg-danger px-1.5 text-xs text-bg">{stopCount}</span>}
          </button>
        </div>
        <span className="text-sm text-muted">Блюдо на стопе гости не видят. ★ — закрепить в хитах.</span>
      </div>

      {categories.map((c, ci) => {
        const list = filter === "stop" ? c.dishes.filter((d) => !d.inStock) : c.dishes;
        if (filter === "stop" && list.length === 0) return null;
        return (
          <section key={c.id} className="flex flex-col gap-2">
            <CategoryHeader cat={c} first={ci === 0} last={ci === categories.length - 1} pending={pending} run={run} />
            {list.map((d, di) => (
              <div key={d.id} className={`flex items-center gap-3 rounded-2xl bg-surface p-2.5 ${d.inStock ? "" : "opacity-70"}`}>
                <DishPhoto url={d.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl" />
                <Link href={`/admin/menu/dish/${d.id}`} className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold">{d.name}</span>
                  <span className="truncate text-xs text-muted">
                    {formatSom(d.price)}
                    {d.isSignature && " · фирменное"}
                    {d.missingKy && <span className="text-warn"> · нет перевода KG</span>}
                  </span>
                </Link>
                <div className="hidden flex-col sm:flex">
                  <button type="button" aria-label="Выше" disabled={pending || di === 0} onClick={() => run(() => moveDishAction(d.id, -1))} className="h-5 px-2 text-xs text-muted disabled:opacity-30">▲</button>
                  <button type="button" aria-label="Ниже" disabled={pending || di === list.length - 1} onClick={() => run(() => moveDishAction(d.id, 1))} className="h-5 px-2 text-xs text-muted disabled:opacity-30">▼</button>
                </div>
                <button type="button" aria-label={d.hitPinned ? "Убрать из хитов" : "Закрепить в хитах"} aria-pressed={d.hitPinned} disabled={pending}
                  onClick={() => run(() => setDishFlagAction(d.id, "hitPinned", !d.hitPinned))}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${d.hitPinned ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"}`}>
                  ★
                </button>
                <button type="button" aria-pressed={!d.inStock} disabled={pending}
                  onClick={() => run(() => setDishFlagAction(d.id, "inStock", !d.inStock))}
                  className={`h-10 w-[84px] rounded-xl text-xs font-extrabold ${d.inStock ? "bg-ok/15 text-ok" : "bg-danger text-bg"}`}>
                  {d.inStock ? "В наличии" : "СТОП"}
                </button>
              </div>
            ))}
            {filter === "all" && (
              <Link href={`/admin/menu/dish/new?category=${c.id}`} className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-sm font-bold text-muted">
                <PlusIcon size={16} /> Блюдо в «{c.nameRu}»
              </Link>
            )}
          </section>
        );
      })}

      {filter === "all" && (
        <form action={createCategoryAction} className="flex flex-col gap-2 rounded-2xl bg-surface p-4 sm:flex-row">
          <input name="nameRu" required maxLength={60} placeholder="Новая категория (RU)" aria-label="Новая категория на русском" className={input} />
          <input name="nameKy" maxLength={60} placeholder="Кыргызча" aria-label="Новая категория на кыргызском" className={input} />
          <button type="submit" className={`${btnPrimary} shrink-0`}><PlusIcon size={18} /> Категория</button>
        </form>
      )}
    </div>
  );
}

function CategoryHeader({ cat, first, last, pending, run }: { cat: Cat; first: boolean; last: boolean; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [editing, setEditing] = useState(false);
  const [ru, setRu] = useState(cat.nameRu);
  const [ky, setKy] = useState(cat.nameKy);
  if (editing) {
    return (
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); run(() => renameCategoryAction(cat.id, ru, ky)); setEditing(false); }}>
        <input value={ru} onChange={(e) => setRu(e.target.value)} required maxLength={60} aria-label="Название RU" className={input} />
        <input value={ky} onChange={(e) => setKy(e.target.value)} maxLength={60} aria-label="Название KG" placeholder="Кыргызча" className={input} />
        <button type="submit" className={`${btnPrimary} shrink-0`}>Сохранить</button>
        <button type="button" onClick={() => setEditing(false)} className={`${btnSecondary} shrink-0`}>Отмена</button>
      </form>
    );
  }
  return (
    <div className="flex items-center gap-2 pt-2">
      <h2 className="flex-1 text-lg font-extrabold">
        {cat.nameRu}
        {cat.nameKy ? <span className="ml-2 text-sm font-semibold text-muted">{cat.nameKy}</span> : <span className="ml-2 text-xs font-semibold text-warn">нет перевода KG</span>}
      </h2>
      <button type="button" aria-label="Категорию выше" disabled={pending || first} onClick={() => run(() => moveCategoryAction(cat.id, -1))} className="h-9 w-9 rounded-xl bg-surface text-muted disabled:opacity-30">▲</button>
      <button type="button" aria-label="Категорию ниже" disabled={pending || last} onClick={() => run(() => moveCategoryAction(cat.id, 1))} className="h-9 w-9 rounded-xl bg-surface text-muted disabled:opacity-30">▼</button>
      <button type="button" aria-label="Переименовать" onClick={() => setEditing(true)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-muted"><EditIcon size={16} /></button>
      {cat.dishes.length === 0 && (
        <button type="button" aria-label="Удалить категорию" disabled={pending} onClick={() => run(() => deleteCategoryAction(cat.id))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-danger"><TrashIcon size={16} /></button>
      )}
    </div>
  );
}
