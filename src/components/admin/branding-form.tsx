"use client";

import { useRef, useState, useTransition } from "react";
import { uploadImageAction } from "@/app/actions/admin-menu";
import { saveBrandingAction } from "@/app/actions/admin-venue";
import { ImageIcon } from "@/components/icons";
import { btnPrimary, btnSecondary } from "@/lib/ui";

type Brand = { logoUrl: string | null; backgroundUrl: string | null; backgroundDim: number };

export function BrandingForm({ venueName, previewUrl, initial }: { venueName: string; previewUrl: string | null; initial: Brand }) {
  const [b, setB] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<"logo" | "bg" | null>(null);
  const [pending, start] = useTransition();
  const logoRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File, which: "logo" | "bg") => {
    setBusy(which);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await uploadImageAction(fd);
    setBusy(null);
    if (!r.ok) return setMsg({ ok: false, text: "Не удалось загрузить. Подойдёт JPG, PNG или WebP до 8 МБ." });
    setB((x) => (which === "logo" ? { ...x, logoUrl: r.url } : { ...x, backgroundUrl: r.url }));
  };

  const save = () =>
    start(async () => {
      const ok = await saveBrandingAction(b);
      setMsg(ok ? { ok: true, text: "Сохранено, гости увидят сразу" } : { ok: false, text: "Не получилось сохранить" });
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">Меню у всех заведений в едином тёмном стиле. Своё у вас — логотип и фоновое фото шапки.</p>

        <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
          <h2 className="text-lg font-extrabold">Логотип</h2>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-surface-2 text-muted">
              {b.logoUrl ? <img src={b.logoUrl} alt="Логотип" className="h-full w-full object-cover" /> : <ImageIcon size={26} />}
            </div>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => logoRef.current?.click()} className={`${btnSecondary} h-10 text-sm`}>{busy === "logo" ? "Загружаем…" : b.logoUrl ? "Заменить" : "Загрузить"}</button>
              {b.logoUrl && <button type="button" onClick={() => setB({ ...b, logoUrl: null })} className="text-sm font-semibold text-muted">Убрать</button>}
            </div>
          </div>
          <p className="text-xs text-muted">Квадратная картинка, лучше от 256×256.</p>
          <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Файл логотипа"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "logo"); e.target.value = ""; }} />
        </section>

        <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
          <h2 className="text-lg font-extrabold">Фон шапки</h2>
          <button type="button" onClick={() => bgRef.current?.click()}
            className="relative flex aspect-[2/1] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface-2 text-muted">
            {b.backgroundUrl ? <img src={b.backgroundUrl} alt="Фон" className="absolute inset-0 h-full w-full object-cover" /> : (
              <span className="flex flex-col items-center gap-2 text-sm font-semibold"><ImageIcon size={26} />{busy === "bg" ? "Загружаем…" : "Загрузить фото зала или блюда"}</span>
            )}
          </button>
          {b.backgroundUrl && <button type="button" onClick={() => setB({ ...b, backgroundUrl: null })} className="self-start text-sm font-semibold text-muted">Убрать фон</button>}
          <input ref={bgRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Файл фона"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "bg"); e.target.value = ""; }} />
          <label className="flex flex-col gap-2 text-sm text-muted">
            Затемнение фона: {b.backgroundDim}% (чтобы название читалось)
            <input type="range" min={0} max={90} step={5} value={b.backgroundDim} onChange={(e) => setB({ ...b, backgroundDim: Number(e.target.value) })} className="accent-[var(--color-accent)]" />
          </label>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={pending || !!busy} onClick={save} className={btnPrimary}>Сохранить</button>
          {previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-accent">Открыть меню гостя</a>}
          {msg && <span role="status" className={`text-sm font-semibold ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">Так увидят гости</span>
        <div className="overflow-hidden rounded-[28px] border border-line bg-bg">
          <div className="relative h-52 overflow-hidden bg-photo">
            {b.backgroundUrl && <img src={b.backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
            <div className="absolute inset-0" style={{ background: `rgba(15,16,18,${b.backgroundDim / 100})` }} />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-bg" />
            <div className="absolute bottom-3 left-5 flex items-center gap-3">
              {b.logoUrl ? <img src={b.logoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" /> : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-text text-lg font-extrabold text-bg">{venueName.replace(/[^\p{L}]/gu, "").slice(0, 1)}</div>
              )}
              <div className="flex flex-col">
                <span className="text-[22px] font-extrabold leading-tight">{venueName}</span>
                <span className="text-sm text-muted">Стол 1</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 px-5 pb-5 pt-3">
            <div className="h-12 rounded-2xl border border-line bg-surface" />
            <div className="flex gap-2"><div className="h-9 w-16 rounded-full bg-accent" /><div className="h-9 w-24 rounded-full bg-surface" /><div className="h-9 w-20 rounded-full bg-surface" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
