"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createStaffAction, setWaiterTablesAction, updateStaffAction } from "@/app/actions/admin-venue";
import { PlusIcon } from "@/components/icons";
import { btnPrimary, btnSecondary, input } from "@/lib/ui";

type Person = { id: string; name: string; role: "waiter" | "kitchen"; active: boolean; hasPin: boolean };
type Tbl = { id: string; number: number; waiterIds: string[] };

export function StaffEditor({ loginUrl, slug, mode, staff, tables }: { loginUrl: string; slug: string; mode: "any" | "assigned"; staff: Person[]; tables: Tbl[] }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [role, setRole] = useState<"waiter" | "kitchen">("waiter");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () =>
    start(async () => {
      const ok = await createStaffAction({ name, role, pin });
      if (ok) { setName(""); setPin(""); setError(null); } else setError("Укажите имя и PIN из 4–6 цифр");
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4 text-sm">
        <span className="text-muted">Вход для персонала (официанты и кухня):</span>
        <a href={loginUrl} className="break-all font-bold text-accent">{loginUrl}</a>
        <span className="text-muted">Код заведения: <b className="text-text">{slug}</b>. Каждый выбирает своё имя и вводит PIN.</span>
      </div>

      <div className="flex flex-col gap-2">
        {staff.map((p) => <PersonRow key={p.id} p={p} mode={mode} tables={tables} pending={pending} start={start} />)}
      </div>

      <form className="flex flex-col gap-2 rounded-2xl bg-surface p-4 sm:flex-row" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" aria-label="Имя" maxLength={40} required className={input} />
        <select value={role} onChange={(e) => setRole(e.target.value as "waiter" | "kitchen")} aria-label="Роль" className={`${input} sm:w-40`}>
          <option value="waiter">Официант</option>
          <option value="kitchen">Кухня</option>
        </select>
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="PIN 4–6 цифр" aria-label="PIN" required className={`${input} sm:w-36`} />
        <button type="submit" disabled={pending} className={`${btnPrimary} shrink-0`}><PlusIcon size={18} /> Добавить</button>
      </form>
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}

      {mode === "any" && (
        <p className="text-sm text-muted">
          Сейчас любой официант может взять любой стол. Закрепить столы за официантами можно в <Link href="/admin/settings" className="font-bold text-accent">настройках</Link>.
        </p>
      )}
    </div>
  );
}

function PersonRow({ p, mode, tables, pending, start }: { p: Person; mode: "any" | "assigned"; tables: Tbl[]; pending: boolean; start: (fn: () => Promise<void>) => void }) {
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [tablesOpen, setTablesOpen] = useState(false);
  const mine = tables.filter((t) => t.waiterIds.includes(p.id));
  const [picked, setPicked] = useState<Set<string>>(new Set(mine.map((t) => t.id)));

  return (
    <article className={`flex flex-col gap-3 rounded-2xl bg-surface p-3.5 ${p.active ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-lg font-extrabold">{p.name.slice(0, 1)}</div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-bold">{p.name}</span>
          <span className="text-xs text-muted">
            {p.role === "waiter" ? "Официант" : "Кухня"}
            {!p.active && " · отключён"}
            {p.role === "waiter" && mode === "assigned" && ` · столы: ${mine.length ? mine.map((t) => t.number).join(", ") : "не закреплены"}`}
          </span>
        </div>
        <button type="button" onClick={() => setPinOpen((v) => !v)} className="h-9 rounded-xl bg-surface-2 px-3 text-xs font-bold">PIN</button>
        <button type="button" disabled={pending} onClick={() => start(async () => void (await updateStaffAction(p.id, { active: !p.active })))}
          className="h-9 rounded-xl bg-surface-2 px-3 text-xs font-bold">{p.active ? "Отключить" : "Включить"}</button>
      </div>

      {pinOpen && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { if (await updateStaffAction(p.id, { pin })) { setPin(""); setPinOpen(false); } }); }}>
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="Новый PIN" aria-label={`Новый PIN для ${p.name}`} className={input} />
          <button type="submit" disabled={pending || pin.length < 4} className={`${btnPrimary} shrink-0`}>Сохранить</button>
        </form>
      )}

      {p.role === "waiter" && mode === "assigned" && (
        tablesOpen ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {tables.map((t) => {
                const on = picked.has(t.id);
                const taken = !on && t.waiterIds.length > 0;
                return (
                  <button key={t.id} type="button" aria-pressed={on}
                    onClick={() => setPicked((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })}
                    className={`h-10 w-10 rounded-xl text-sm font-extrabold ${on ? "bg-accent text-accent-ink" : taken ? "bg-surface-2 text-muted/60" : "bg-surface-2"}`}>
                    {t.number}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={() => start(async () => { await setWaiterTablesAction(p.id, [...picked]); setTablesOpen(false); })} className={`${btnPrimary} h-10`}>Сохранить столы</button>
              <button type="button" onClick={() => setTablesOpen(false)} className={`${btnSecondary} h-10`}>Отмена</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setTablesOpen(true)} className="self-start text-sm font-bold text-accent">Закрепить столы</button>
        )
      )}
    </article>
  );
}
