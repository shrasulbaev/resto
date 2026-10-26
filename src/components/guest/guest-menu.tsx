"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { formatSom, LANG_COOKIE, LANGS, t, type Lang } from "@/lib/i18n";
import { DishPhoto } from "./dish-photo";
import { DishSheet } from "./dish-sheet";
import type { GuestDish, GuestMenuData } from "./types";

export function GuestMenu({
  data,
  onAdd,
  sheetFooter,
  bottomBar,
}: {
  data: GuestMenuData;
  onAdd?: (dish: GuestDish) => void;
  sheetFooter?: (dish: GuestDish, close: () => void) => React.ReactNode;
  bottomBar?: React.ReactNode;
}) {
  const d = t(data.lang);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(data.dishes.map((x) => [x.id, x])), [data.dishes]);
  const hits = data.hitIds.map((id) => byId.get(id)).filter((x): x is GuestDish => !!x);
  const signature = data.dishes.filter((x) => x.isSignature);
  const q = query.trim().toLowerCase();
  const found = q ? data.dishes.filter((x) => x.name.toLowerCase().includes(q) || x.searchText.includes(q)) : [];
  const open = openId ? byId.get(openId) : undefined;

  const setLang = (lang: Lang) => {
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const add = (dish: GuestDish) => (onAdd ? onAdd(dish) : setOpenId(dish.id));

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-32">
      <header className="relative h-52 overflow-hidden bg-photo">
        {data.venue.backgroundUrl && (
          <img src={data.venue.backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0" style={{ background: `rgba(15,16,18,${data.venue.backgroundDim / 100})` }} />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-bg" />
        <div className="absolute right-4 top-4 flex gap-1 rounded-full bg-bg/70 p-1">
          {LANGS.map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={data.lang === l}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${data.lang === l ? "bg-text text-bg" : "text-text"}`}>
              {l === "ru" ? "RU" : "KG"}
            </button>
          ))}
        </div>
        <div className="absolute bottom-3 left-5 flex items-center gap-3">
          {data.venue.logoUrl ? (
            <img src={data.venue.logoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-text text-lg font-extrabold text-bg">
              {data.venue.name.replace(/[^\p{L}]/gu, "").slice(0, 1)}
            </div>
          )}
          <div className="flex flex-col">
            <h1 className="text-[22px] font-extrabold leading-tight">{data.venue.name}</h1>
            <span className="text-sm text-muted">{d.table} {data.tableNumber}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 px-5 pt-3">
        <label className="flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5">
          <SearchIcon className="text-muted" size={18} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={d.search} aria-label={d.search}
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted" />
        </label>

        {q ? (
          <section className="flex flex-col gap-2.5">
            {found.length === 0 && <p className="py-6 text-center text-muted">{d.nothingFound}</p>}
            {found.map((x) => <DishRow key={x.id} dish={x} lang={data.lang} onOpen={() => setOpenId(x.id)} onAdd={() => add(x)} />)}
          </section>
        ) : (
          <>
            <nav className="sticky top-0 z-10 -mx-5 flex gap-2 overflow-x-auto bg-bg/95 px-5 py-2 backdrop-blur [scrollbar-width:none]">
              {hits.length > 0 && <Chip onClick={() => jump("sec-hits")} accent>{d.hits}</Chip>}
              {signature.length > 0 && <Chip onClick={() => jump("sec-signature")}>{d.signature}</Chip>}
              {data.categories.map((c) => <Chip key={c.id} onClick={() => jump(`sec-${c.id}`)}>{c.name}</Chip>)}
            </nav>

            {hits.length > 0 && (
              <section id="sec-hits" className="flex scroll-mt-16 flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-xl font-extrabold">{d.hits}</h2>
                  <span className="text-sm text-muted">{d.hitsHint}</span>
                </div>
                <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
                  {hits.map((x) => (
                    <article key={x.id} className="w-40 shrink-0 overflow-hidden rounded-[18px] bg-surface">
                      <button type="button" onClick={() => setOpenId(x.id)} className="relative block w-full text-left">
                        <DishPhoto url={x.photoUrl} alt={x.name} className="h-26 w-full" />
                        <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-ink">{d.hit}</span>
                      </button>
                      <div className="flex flex-col gap-1 px-3 pb-3 pt-2.5">
                        <button type="button" onClick={() => setOpenId(x.id)} className="text-left text-[15px] font-bold leading-snug">{x.name}</button>
                        {x.kcal !== null && <span className="text-xs text-muted">{x.kcal} {d.kcal}{x.weight ? ` · ${x.weight}` : ""}</span>}
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[15px] font-extrabold">{formatSom(x.price)}</span>
                          <AddButton label={x.name} onClick={() => add(x)} />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {signature.length > 0 && (
              <section id="sec-signature" className="flex scroll-mt-16 flex-col gap-2.5">
                <h2 className="text-xl font-extrabold">{d.signature}</h2>
                {signature.map((x) => <DishRow key={x.id} dish={x} lang={data.lang} onOpen={() => setOpenId(x.id)} onAdd={() => add(x)} />)}
              </section>
            )}

            {data.categories.map((c) => (
              <section key={c.id} id={`sec-${c.id}`} className="flex scroll-mt-16 flex-col gap-2.5">
                <h2 className="text-xl font-extrabold">{c.name}</h2>
                {c.dishIds.map((id) => byId.get(id)).filter((x): x is GuestDish => !!x).map((x) => (
                  <DishRow key={x.id} dish={x} lang={data.lang} onOpen={() => setOpenId(x.id)} onAdd={() => add(x)} />
                ))}
              </section>
            ))}
          </>
        )}
      </div>

      {open && (
        <DishSheet dish={open} lang={data.lang} isHit={data.hitIds.includes(open.id)} onClose={() => setOpenId(null)}
          footer={sheetFooter?.(open, () => setOpenId(null))} />
      )}
      {bottomBar}
    </div>
  );
}

function Chip({ children, onClick, accent }: { children: React.ReactNode; onClick: () => void; accent?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold ${accent ? "bg-accent text-accent-ink" : "border border-line bg-surface"}`}>
      {children}
    </button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={`Добавить: ${label}`} onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-xl bg-line text-text active:scale-95">
      <PlusIcon size={18} />
    </button>
  );
}

function DishRow({ dish, lang, onOpen, onAdd }: { dish: GuestDish; lang: Lang; onOpen: () => void; onAdd: () => void }) {
  const d = t(lang);
  return (
    <article className="flex gap-3 rounded-[18px] bg-surface p-2.5">
      <button type="button" onClick={onOpen} className="shrink-0" aria-label={dish.name}>
        <DishPhoto url={dish.photoUrl} alt="" className="h-21 w-21 rounded-[14px]" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button type="button" onClick={onOpen} className="text-left text-[15px] font-bold leading-snug">{dish.name}</button>
        {(dish.description || dish.composition) && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted">{dish.description ?? dish.composition}</p>
        )}
        <div className="mt-auto flex items-center justify-between">
          <span className="text-[15px] font-extrabold">
            {formatSom(dish.price)}
            {dish.kcal !== null && <span className="text-xs font-medium text-muted"> · {dish.kcal} {d.kcal}</span>}
          </span>
          <AddButton label={dish.name} onClick={onAdd} />
        </div>
      </div>
    </article>
  );
}
