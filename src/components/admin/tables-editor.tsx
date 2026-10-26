"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addTablesAction, deleteTableAction, reissueQrAction, renumberTableAction } from "@/app/actions/admin-venue";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { btnPrimary, btnSecondary } from "@/lib/ui";

type Row = { id: string; number: number; status: "closed" | "pending" | "open"; url: string; svg: string };

const STATUS = { closed: "свободен", pending: "зовут официанта", open: "открыт" };

export function TablesEditor({ tables }: { tables: Row[] }) {
  const [pending, start] = useTransition();
  const [n, setN] = useState(1);
  const run = (fn: () => Promise<unknown>) => start(async () => void (await fn()));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-2xl bg-surface p-1.5">
          <input type="number" min={1} max={100} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Сколько столов добавить"
            className="h-10 w-16 rounded-xl bg-bg px-3 text-center font-bold outline-none" />
          <button type="button" disabled={pending} onClick={() => run(() => addTablesAction(n))} className={`${btnPrimary} h-10`}>
            <PlusIcon size={18} /> Добавить столы
          </button>
        </div>
        <Link href="/print/qr" target="_blank" className={`${btnSecondary} h-12`}>Печать QR-кодов</Link>
      </div>
      <p className="text-sm text-muted">
        Новый QR нужен, если старый код сфотографировали и балуются: старая ссылка перестаёт работать, наклейку на столе надо заменить.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((t) => <TableCard key={t.id} t={t} pending={pending} run={run} />)}
      </div>
    </div>
  );
}

function TableCard({ t, pending, run }: { t: Row; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [num, setNum] = useState(String(t.number));
  const [error, setError] = useState(false);
  const save = () => {
    const v = Number(num);
    if (v === t.number) return;
    run(async () => {
      const ok = await renumberTableAction(t.id, v);
      setError(!ok);
      if (!ok) setNum(String(t.number));
    });
  };
  return (
    <article className="flex gap-3 rounded-2xl bg-surface p-3">
      <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-white p-1" dangerouslySetInnerHTML={{ __html: t.svg }} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label className="flex items-center gap-2 text-sm text-muted">
          Стол
          <input value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ""))} onBlur={save} onKeyDown={(e) => e.key === "Enter" && save()}
            aria-label="Номер стола" className={`h-9 w-16 rounded-lg border bg-bg px-2 text-lg font-extrabold text-text outline-none ${error ? "border-danger" : "border-line"}`} />
        </label>
        <span className={`text-xs font-semibold ${t.status === "closed" ? "text-muted" : "text-ok"}`}>{STATUS[t.status]}</span>
        <div className="mt-auto flex gap-1.5">
          <button type="button" disabled={pending}
            onClick={() => confirm(`Выпустить новый QR для стола ${t.number}? Старый код перестанет работать.`) && run(() => reissueQrAction(t.id))}
            className="h-9 flex-1 rounded-xl bg-surface-2 text-xs font-bold disabled:opacity-50">
            Новый QR
          </button>
          <a href={t.url} target="_blank" rel="noreferrer" className="flex h-9 items-center rounded-xl bg-surface-2 px-3 text-xs font-bold">Открыть</a>
          {t.status === "closed" && (
            <button type="button" aria-label={`Удалить стол ${t.number}`} disabled={pending}
              onClick={() => confirm(`Удалить стол ${t.number}?`) && run(() => deleteTableAction(t.id))}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-danger"><TrashIcon size={15} /></button>
          )}
        </div>
      </div>
    </article>
  );
}
