"use client";

import { useState, useTransition } from "react";
import { saveSettingsAction } from "@/app/actions/admin-venue";
import { btnPrimary, input, label } from "@/lib/ui";

type Form = {
  allDay: boolean; opensAt: string; closesAt: string; callPauseMin: string; maxPendingCalls: string;
  autoCloseHours: string; assignmentMode: "any" | "assigned"; escalateAfterMin: string;
};

export function SettingsForm({ initial }: { initial: Form }) {
  const [f, setF] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((x) => ({ ...x, [k]: v })); setMsg(null); };
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 2);

  const save = () =>
    start(async () => {
      const r = await saveSettingsAction(f);
      setMsg(r.ok ? { ok: true, text: "Сохранено" } : { ok: false, text: "Проверьте значения: время в формате ЧЧ:ММ, числа в допустимых пределах" });
    });

  const total = Number(f.callPauseMin) * Number(f.maxPendingCalls);

  return (
    <form className="flex max-w-2xl flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <Card title="Часы работы" hint="Вне этих часов гости видят меню, но позвать официанта нельзя.">
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input type="checkbox" checked={f.allDay} onChange={(e) => set("allDay", e.target.checked)} className="h-5 w-5 accent-[var(--color-accent)]" />
          Круглосуточно
        </label>
        {!f.allDay && (
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>Открытие<input type="time" value={f.opensAt} onChange={(e) => set("opensAt", e.target.value)} className={input} /></label>
            <label className={label}>Закрытие<input type="time" value={f.closesAt} onChange={(e) => set("closesAt", e.target.value)} className={input} /></label>
          </div>
        )}
      </Card>

      <Card title="Вызов официанта" hint={`Пока никто не принял вызов, гость может позвать ещё раз через паузу. Если и после последнего вызова никто не подошёл (примерно через ${total || "…"} мин), стол закрывается, гость сканирует QR заново, а вам приходит сигнал.`}>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>Пауза между вызовами, мин<input inputMode="numeric" value={f.callPauseMin} onChange={(e) => set("callPauseMin", digits(e.target.value))} className={input} /></label>
          <label className={label}>Сколько раз можно позвать<input inputMode="numeric" value={f.maxPendingCalls} onChange={(e) => set("maxPendingCalls", digits(e.target.value))} className={input} /></label>
        </div>
        <label className={label}>
          Закрыть стол, если нет активности, часов
          <input inputMode="numeric" value={f.autoCloseHours} onChange={(e) => set("autoCloseHours", digits(e.target.value))} className={input} />
        </label>
      </Card>

      <Card title="Кто обслуживает столы">
        <Radio checked={f.assignmentMode === "any"} onChange={() => set("assignmentMode", "any")} title="Любой официант">
          Вызов видят все официанты, стол берёт тот, кто первым принял.
        </Radio>
        <Radio checked={f.assignmentMode === "assigned"} onChange={() => set("assignmentMode", "assigned")} title="Закреплённые столы">
          Вызов идёт официанту, за которым закреплён стол (закрепить — в разделе «Персонал»). Если он не принял вовремя, вызов видят все.
        </Radio>
        {f.assignmentMode === "assigned" && (
          <label className={label}>
            Передать всем, если не приняли за, мин
            <input inputMode="numeric" value={f.escalateAfterMin} onChange={(e) => set("escalateAfterMin", digits(e.target.value))} className={input} />
          </label>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={btnPrimary}>Сохранить</button>
        {msg && <span role="status" className={`text-sm font-semibold ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-extrabold">{title}</h2>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Radio({ checked, onChange, title, children }: { checked: boolean; onChange: () => void; title: string; children: React.ReactNode }) {
  return (
    <label className={`flex cursor-pointer gap-3 rounded-2xl border p-3.5 ${checked ? "border-accent bg-accent/5" : "border-line"}`}>
      <input type="radio" checked={checked} onChange={onChange} className="mt-1 h-4 w-4 accent-[var(--color-accent)]" />
      <span className="flex flex-col gap-0.5">
        <span className="font-bold">{title}</span>
        <span className="text-sm text-muted">{children}</span>
      </span>
    </label>
  );
}
