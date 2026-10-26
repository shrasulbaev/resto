"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteDishAction, saveDishAction, uploadImageAction } from "@/app/actions/admin-menu";
import { BackIcon, ImageIcon, TrashIcon } from "@/components/icons";
import { btnPrimary, btnSecondary, input, label } from "@/lib/ui";

type Form = {
  categoryId: string; nameRu: string; nameKy: string; descriptionRu: string; descriptionKy: string; compositionRu: string; compositionKy: string;
  price: string; weight: string; kcal: string; protein: string; fat: string; carbs: string;
  allergens: string[]; tags: string[]; isSignature: boolean; hitPinned: boolean; inStock: boolean; photoUrl: string | null;
};

const EMPTY: Form = {
  categoryId: "", nameRu: "", nameKy: "", descriptionRu: "", descriptionKy: "", compositionRu: "", compositionKy: "",
  price: "", weight: "", kcal: "", protein: "", fat: "", carbs: "", allergens: [], tags: [], isSignature: false, hitPinned: false, inStock: true, photoUrl: null,
};

const FIELD_NAMES: Record<string, string> = { nameRu: "название", price: "цена", kcal: "калории", protein: "белки", fat: "жиры", carbs: "углеводы", categoryId: "категория" };

export function DishForm({
  id, categories, allergens, tags, initial,
}: {
  id: string | null;
  categories: { id: string; name: string }[];
  allergens: string[];
  tags: { id: string; label: string }[];
  initial: Partial<Form>;
}) {
  const router = useRouter();
  const [f, setF] = useState<Form>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<"ru" | "ky">("ru");
  const [extraAllergen, setExtraAllergen] = useState("");
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (k: "allergens" | "tags", v: string) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v]);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await uploadImageAction(fd);
    setUploading(false);
    if (r.ok) set("photoUrl", r.url);
    else setError("Не удалось загрузить фото. Подойдёт JPG, PNG или WebP до 8 МБ.");
  };

  const save = () =>
    start(async () => {
      setError(null);
      const r = await saveDishAction(id, f);
      if (r.ok) router.push("/admin/menu");
      else setError(`Проверьте поле: ${FIELD_NAMES[r.error] ?? r.error}`);
    });

  const remove = () =>
    start(async () => {
      if (!id || !confirm(`Удалить «${f.nameRu}»? Это нельзя отменить. Если блюдо временно закончилось, лучше поставить его на стоп.`)) return;
      await deleteDishAction(id);
      router.push("/admin/menu");
    });

  const L = lang === "ru" ? "Ru" : "Ky";
  const allAllergens = [...new Set([...allergens, ...f.allergens])];

  return (
    <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="flex items-center gap-3">
        <Link href="/admin/menu" aria-label="Назад" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface"><BackIcon /></Link>
        <h1 className="flex-1 text-2xl font-extrabold">{id ? f.nameRu || "Блюдо" : "Новое блюдо"}</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-3">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface text-muted">
            {f.photoUrl ? <img src={f.photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : (
              <span className="flex flex-col items-center gap-2 text-sm font-semibold"><ImageIcon size={28} /> {uploading ? "Загружаем…" : "Добавить фото"}</span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Фото блюда"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); e.target.value = ""; }} />
          {f.photoUrl && (
            <div className="flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className={`${btnSecondary} h-10 flex-1 text-sm`}>{uploading ? "Загружаем…" : "Заменить"}</button>
              <button type="button" onClick={() => set("photoUrl", null)} className={`${btnSecondary} h-10 text-sm`}>Убрать</button>
            </div>
          )}

          <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
            <Check checked={f.inStock} onChange={(v) => set("inStock", v)}>В наличии (иначе на стопе)</Check>
            <Check checked={f.hitPinned} onChange={(v) => set("hitPinned", v)}>Закрепить в хитах</Check>
            <Check checked={f.isSignature} onChange={(v) => set("isSignature", v)}>Фирменное блюдо</Check>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>
              Категория
              <select value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={input}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>Цена, сом<input inputMode="numeric" value={f.price} onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))} required className={input} /></label>
              <label className={label}>Выход<input value={f.weight} onChange={(e) => set("weight", e.target.value)} placeholder="350 г" maxLength={30} className={input} /></label>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
            <div className="flex gap-1 self-start rounded-full bg-bg p-1">
              {(["ru", "ky"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
                  className={`h-8 rounded-full px-4 text-sm font-bold ${lang === l ? "bg-text text-bg" : "text-muted"}`}>
                  {l === "ru" ? "Русский" : "Кыргызча"}
                  {l === "ky" && !f.nameKy && <span className="ml-1 text-warn">•</span>}
                </button>
              ))}
            </div>
            <label className={label}>
              Название{lang === "ky" && " (если пусто — покажем русское)"}
              <input value={f[`name${L}`]} onChange={(e) => set(`name${L}`, e.target.value)} required={lang === "ru"} maxLength={80} className={input} />
            </label>
            <label className={label}>
              Описание
              <textarea value={f[`description${L}`]} onChange={(e) => set(`description${L}`, e.target.value)} maxLength={300} rows={2} className={`${input} h-auto py-3`} />
            </label>
            <label className={label}>
              Состав
              <textarea value={f[`composition${L}`]} onChange={(e) => set(`composition${L}`, e.target.value)} maxLength={400} rows={2} placeholder="говядина, лук, специи" className={`${input} h-auto py-3`} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["kcal", "protein", "fat", "carbs"] as const).map((k) => (
              <label key={k} className={label}>
                {{ kcal: "Ккал", protein: "Белки, г", fat: "Жиры, г", carbs: "Углеводы, г" }[k]}
                <input inputMode="decimal" value={f[k]} onChange={(e) => set(k, e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))} className={input} />
              </label>
            ))}
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm text-muted">Аллергены</legend>
            <div className="flex flex-wrap gap-2">
              {allAllergens.map((a) => <Chip key={a} on={f.allergens.includes(a)} onClick={() => toggle("allergens", a)}>{a}</Chip>)}
              <input value={extraAllergen} onChange={(e) => setExtraAllergen(e.target.value)} placeholder="+ свой" maxLength={30} aria-label="Добавить аллерген"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = extraAllergen.trim().toLowerCase(); if (v && !f.allergens.includes(v)) set("allergens", [...f.allergens, v]); setExtraAllergen(""); } }}
                className="h-9 w-28 rounded-full border border-line bg-bg px-3 text-sm outline-none focus:border-accent" />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm text-muted">Метки</legend>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => <Chip key={t.id} on={f.tags.includes(t.id)} onClick={() => toggle("tags", t.id)}>{t.label}</Chip>)}
            </div>
          </fieldset>
        </div>
      </div>

      {error && <p role="alert" className="rounded-2xl bg-danger/15 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        {id && (
          <button type="button" onClick={remove} disabled={pending} aria-label="Удалить блюдо" className={`${btnSecondary} text-danger`}>
            <TrashIcon size={18} />
          </button>
        )}
        <Link href="/admin/menu" className={`${btnSecondary} flex-1 sm:flex-none`}>Отмена</Link>
        <button type="submit" disabled={pending || uploading} className={`${btnPrimary} flex-[2] sm:ml-auto sm:flex-none`}>Сохранить</button>
      </div>
    </form>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-3 text-sm font-semibold">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[var(--color-accent)]" />
      {children}
    </label>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`h-9 rounded-full px-3.5 text-sm font-bold ${on ? "bg-accent text-accent-ink" : "border border-line bg-surface text-muted"}`}>
      {children}
    </button>
  );
}
