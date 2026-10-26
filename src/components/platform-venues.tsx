"use client";

import { useState, useTransition } from "react";
import { createVenueAction, resetOwnerPasswordAction, setVenueActiveAction } from "@/app/actions/platform";
import { PlusIcon } from "@/components/icons";
import { btnPrimary, btnSecondary, input, label } from "@/lib/ui";

type Venue = { id: string; name: string; slug: string; active: boolean; tables: number; staff: number; owners: string[] };

const ERRORS: Record<string, string> = {
  slug_taken: "Такой код уже занят",
  email_taken: "Эта почта уже используется",
  slug: "Код: латиница, цифры и дефис, 3–32 символа",
  ownerEmail: "Проверьте почту",
  ownerPassword: "Пароль — минимум 8 символов",
  name: "Укажите название",
};

export function PlatformVenues({ venues, appUrl }: { venues: Venue[]; appUrl: string }) {
  const [pending, start] = useTransition();
  const [f, setF] = useState({ name: "", slug: "", ownerEmail: "", ownerPassword: "", tables: "10" });
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const create = () =>
    start(async () => {
      const r = await createVenueAction(f);
      if (r.ok) {
        setCreated(`Создано: вход владельца ${appUrl}/login (${f.ownerEmail}), персонал ${appUrl}/s/${f.slug.toLowerCase()}`);
        setF({ name: "", slug: "", ownerEmail: "", ownerPassword: "", tables: "10" });
        setError(null);
      } else setError(ERRORS[r.error] ?? "Проверьте поля");
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        {venues.map((v) => <VenueRow key={v.id} v={v} pending={pending} start={start} />)}
        {venues.length === 0 && <p className="py-8 text-center text-muted">Пока нет заведений</p>}
      </div>

      <form className="flex flex-col gap-3 rounded-2xl bg-surface p-4" onSubmit={(e) => { e.preventDefault(); create(); }}>
        <h2 className="text-lg font-extrabold">Новое заведение</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>Название<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required className={input} /></label>
          <label className={label}>Код (для входа персонала)<input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} required placeholder="chaikhana" className={input} /></label>
          <label className={label}>Почта владельца<input type="email" value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} required className={input} /></label>
          <label className={label}>Пароль владельца<input value={f.ownerPassword} onChange={(e) => setF({ ...f, ownerPassword: e.target.value })} required minLength={8} className={input} /></label>
          <label className={label}>Сколько столов сразу<input inputMode="numeric" value={f.tables} onChange={(e) => setF({ ...f, tables: e.target.value.replace(/\D/g, "") })} className={input} /></label>
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        {created && <p role="status" className="break-all text-sm font-semibold text-ok">{created}</p>}
        <button type="submit" disabled={pending} className={`${btnPrimary} self-start`}><PlusIcon size={18} /> Создать</button>
      </form>
    </div>
  );
}

function VenueRow({ v, pending, start }: { v: Venue; pending: boolean; start: (fn: () => Promise<void>) => void }) {
  const [pw, setPw] = useState("");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <article className={`flex flex-col gap-3 rounded-2xl bg-surface p-4 ${v.active ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-extrabold">{v.name}</span>
          <span className="text-xs text-muted">/{v.slug} · столов {v.tables} · персонал {v.staff} · {v.owners.join(", ") || "нет владельца"}</span>
        </div>
        {v.owners[0] && <button type="button" onClick={() => setOpen((x) => !x)} className={`${btnSecondary} h-9 text-xs`}>Пароль владельца</button>}
        <button type="button" disabled={pending} onClick={() => start(() => setVenueActiveAction(v.id, !v.active))} className={`${btnSecondary} h-9 text-xs`}>
          {v.active ? "Отключить" : "Включить"}
        </button>
      </div>
      {open && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { setMsg((await resetOwnerPasswordAction(v.owners[0], pw)) ? "Пароль изменён" : "Минимум 8 символов"); setPw(""); }); }}>
          <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Новый пароль" aria-label="Новый пароль владельца" className={input} />
          <button type="submit" disabled={pending} className={`${btnPrimary} shrink-0`}>Сменить</button>
        </form>
      )}
      {msg && <span className="text-xs font-semibold text-muted">{msg}</span>}
    </article>
  );
}
