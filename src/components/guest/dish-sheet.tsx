"use client";

import { useEffect } from "react";
import { CloseIcon } from "@/components/icons";
import { formatSom, t, type Lang } from "@/lib/i18n";
import { DishPhoto } from "./dish-photo";
import type { GuestDish } from "./types";

export function DishSheet({
  dish,
  lang,
  isHit,
  onClose,
  footer,
}: {
  dish: GuestDish;
  lang: Lang;
  isHit: boolean;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const d = t(lang);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const nutrition = [
    { v: dish.kcal, l: d.kcal, unit: "" },
    { v: dish.protein, l: d.protein, unit: " г" },
    { v: dish.fat, l: d.fat, unit: " г" },
    { v: dish.carbs, l: d.carbs, unit: " г" },
  ].filter((n) => n.v !== null);

  return (
    <div role="dialog" aria-modal="true" aria-label={dish.name} className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-surface" onClick={(e) => e.stopPropagation()}>
        <DishPhoto url={dish.photoUrl} alt={dish.name} className="h-60 w-full shrink-0" />
        <button type="button" aria-label={d.close} onClick={onClose}
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-bg/80">
          <CloseIcon />
        </button>
        <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-5 pt-5">
          <div className="flex flex-wrap gap-1.5">
            {isHit && <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-ink">{d.hit}</span>}
            {dish.isSignature && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold">{d.signatureTag}</span>}
            {dish.tags.includes("spicy") && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold">{d.spicy}</span>}
            {dish.tags.includes("vegetarian") && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold">{d.vegetarian}</span>}
            {dish.tags.includes("new") && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold">{d.new}</span>}
          </div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl font-extrabold leading-tight">{dish.name}</h2>
            <div className="shrink-0 text-right">
              <div className="text-xl font-extrabold">{formatSom(dish.price)}</div>
              {dish.weight && <div className="text-xs text-muted">{dish.weight}</div>}
            </div>
          </div>
          {dish.description && <p className="text-sm leading-relaxed text-[#c9ccd1]">{dish.description}</p>}
          {dish.composition && (
            <p className="text-sm leading-relaxed text-muted">
              <span className="font-bold text-text">{d.composition}:</span> {dish.composition}
            </p>
          )}
          {nutrition.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {nutrition.map((n) => (
                <div key={n.l} className="rounded-2xl bg-surface-2 px-1 py-2.5 text-center">
                  <div className="text-base font-extrabold">{n.v}{n.unit}</div>
                  <div className="text-[11px] text-muted">{n.l}</div>
                </div>
              ))}
            </div>
          )}
          {dish.allergens.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">{d.allergens}:</span>
              {dish.allergens.map((a) => (
                <span key={a} className="rounded-full border border-[#e98a5d] px-2.5 py-1 text-xs font-semibold text-[#f2a77f]">{a}</span>
              ))}
            </div>
          )}
          {footer}
        </div>
      </div>
    </div>
  );
}
