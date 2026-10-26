"use client";

import Link from "next/link";
import { useTransition } from "react";
import { acceptCallAction, completeCallAction, importSelectionAction } from "@/app/actions/waiter";
import { BagIcon, BellIcon, ChatIcon, ReceiptIcon } from "@/components/icons";
import type { BoardCall } from "@/server/waiter";

export function callTitle(c: Pick<BoardCall, "type" | "payload" | "attempt">) {
  if (c.type === "bill") return `Счёт · ${c.payload.payment === "card" ? "картой" : "наличными"}`;
  if (c.type === "container") return "Контейнер";
  if (c.type === "other") return c.payload.comment ?? "Просьба";
  return c.attempt > 1 ? `Зовёт официанта · ${c.attempt}-й раз` : "Зовёт официанта";
}

const icons = { waiter: BellIcon, bill: ReceiptIcon, container: BagIcon, other: ChatIcon };

export function minutesAgo(iso: string, now = Date.now()) {
  const m = Math.floor((now - new Date(iso).getTime()) / 60_000);
  return m < 1 ? "только что" : `${m} мин назад`;
}

export function CallCard({ call, showTable = true }: { call: BoardCall; showTable?: boolean }) {
  const [pending, start] = useTransition();
  const Icon = icons[call.type];
  const selection = call.payload.selection ?? [];
  const isWaiter = call.type === "waiter";
  return (
    <article className={`flex flex-col gap-3 rounded-[20px] border p-4 ${call.escalated ? "border-warn/60 bg-warn/5" : "border-line bg-surface"}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${isWaiter ? "bg-accent text-accent-ink" : "bg-info/15 text-info"}`}>
          <Icon size={22} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          {showTable && (
            <Link href={`/waiter/t/${call.tableId}`} className="text-lg font-extrabold">
              Стол {call.tableNumber}
            </Link>
          )}
          <span className={showTable ? "text-[15px] font-semibold" : "text-lg font-extrabold"}>{callTitle(call)}</span>
          <span className="text-xs text-muted">
            {minutesAgo(call.createdAt)}
            {call.escalated && " · никто не взял, видят все"}
            {selection.length > 0 && ` · выбор гостя: ${selection.reduce((s, i) => s + i.qty, 0)} поз.`}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        {isWaiter ? (
          <>
            <button type="button" disabled={pending} onClick={() => start(async () => void (await acceptCallAction(call.id)))}
              className="h-12 flex-1 rounded-2xl bg-accent font-extrabold text-accent-ink active:scale-[0.98] disabled:opacity-50">
              Принять
            </button>
            {selection.length > 0 && (
              <button type="button" disabled={pending} onClick={() => start(async () => void (await importSelectionAction(call.id)))}
                className="h-12 flex-1 rounded-2xl border border-line bg-surface-2 font-bold disabled:opacity-50">
                С выбором гостя
              </button>
            )}
          </>
        ) : (
          <button type="button" disabled={pending} onClick={() => start(async () => void (await completeCallAction(call.id)))}
            className="h-12 flex-1 rounded-2xl bg-ok font-extrabold text-bg active:scale-[0.98] disabled:opacity-50">
            Выполнено
          </button>
        )}
      </div>
    </article>
  );
}
