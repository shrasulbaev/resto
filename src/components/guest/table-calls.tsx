"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BagIcon, BellIcon, ChatIcon, CloseIcon, ReceiptIcon } from "@/components/icons";
import { fill, t, type Lang } from "@/lib/i18n";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import type { GuestState } from "@/server/tables";
import { GuestApp, SELECTION_RESET, type SelectionApi } from "./guest-app";
import type { GuestMenuData } from "./types";

type CallType = "waiter" | "bill" | "container" | "other";
type CallExtra = { payment?: "cash" | "card"; comment?: string; withSelection?: boolean };

// Live updates come over SSE; the slow poll only covers a dropped stream.
const POLL_MS = 30_000;

// Polls the table state and sends guest calls. The visit key lives in
// localStorage so a reload keeps the phone attached to its visit.
export function useTableCalls(token: string) {
  const storageKey = `resto:visit:${token}`;
  const router = useRouter();
  const [state, setState] = useState<GuestState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const prev = useRef<GuestState | null>(null);

  const readKey = useCallback(() => {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }, [storageKey]);

  const apply = useCallback(
    (s: GuestState) => {
      const before = prev.current;
      try {
        if (s.key) localStorage.setItem(storageKey, s.key);
        else if (s.table === "closed") localStorage.removeItem(storageKey);
      } catch {}
      if (before?.mine && before.table === "pending" && s.table === "closed") setNotice("noResponse");
      // The bill was closed: start the next visit with an empty selection.
      if (before?.mine && before.table === "open" && s.table === "closed") {
        try {
          localStorage.removeItem(`resto:sel:${token}`);
        } catch {}
        window.dispatchEvent(new Event(SELECTION_RESET));
      }
      prev.current = s;
      setState(s);
    },
    [storageKey, token],
  );

  const refresh = useCallback(async (): Promise<void> => {
    const key = readKey();
    const res = await fetch(`/api/t/${token}/state${key ? `?key=${encodeURIComponent(key)}` : ""}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const state = (await res.json()) as GuestState;
    // A call finished while this request was in flight and gave us a key:
    // this answer was computed without it, so ask again.
    if (readKey() !== key) return refresh();
    apply(state);
  }, [token, readKey, apply]);

  useEffect(() => {
    refresh();
    const poll = setInterval(() => document.visibilityState === "visible" && refresh(), POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    const es = typeof EventSource !== "undefined" ? new EventSource(`/api/t/${token}/events`) : null;
    if (es) {
      es.onmessage = (m) => {
        try {
          const type = JSON.parse(m.data).type;
          if (type === "table") refresh();
          // Stop-list or price changes show up without a reload.
          if (type === "menu") router.refresh();
        } catch {}
      };
      // Catch up on anything missed while the stream was reconnecting.
      es.onopen = () => refresh();
    }
    return () => {
      es?.close();
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, token, router]);

  const call = useCallback(
    async (type: CallType, extra: CallExtra, selection: SelectionApi) => {
      const body = {
        key: readKey(),
        type,
        payment: extra.payment,
        comment: extra.comment,
        selection: extra.withSelection && selection.items.length ? selection.items : undefined,
      };
      const res = await fetch(`/api/t/${token}/call`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
      const json = res ? await res.json().catch(() => null) : null;
      if (json?.state) apply(json.state);
      if (json?.ok) return "ok" as const;
      return (json?.error as string | undefined) ?? "error";
    },
    [token, readKey, apply],
  );

  return { state, now, call, notice, clearNotice: () => setNotice(null) };
}

function countdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// The guest menu with call buttons wired to the table state.
export function GuestWithCalls({ data }: { data: GuestMenuData }) {
  const tc = useTableCalls(data.tableToken);
  return (
    <GuestApp
      data={data}
      actions={(place, selection) =>
        place === "bar" ? <BarAction tc={tc} lang={data.lang} selection={selection} /> : <SheetActions tc={tc} lang={data.lang} selection={selection} />
      }
    />
  );
}

type TC = ReturnType<typeof useTableCalls>;

function useSend(tc: TC, lang: Lang, selection: SelectionApi) {
  const d = t(lang);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const send = async (type: CallType, extra: CallExtra = {}) => {
    setBusy(true);
    const r = await tc.call(type, extra, selection);
    setBusy(false);
    const msg = r === "ok" ? (type === "waiter" ? d.callSent : d.requested) : r === "too_soon" ? d.waitAMinute : r === "hours" ? d.closedHours : d.error;
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
    return r;
  };
  return { busy, flash, send };
}

function BarAction({ tc, lang, selection }: { tc: TC; lang: Lang; selection: SelectionApi }) {
  const d = t(lang);
  const { busy, flash, send } = useSend(tc, lang, selection);
  const [menu, setMenu] = useState(false);
  const s = tc.state;

  let button: React.ReactNode;
  if (!s || !s.venueOpen) {
    button = (
      <button type="button" disabled className={`${btnPrimary} h-14 shrink-0 px-4`} aria-label={d.callWaiter}>
        <BellIcon size={20} />
      </button>
    );
  } else if (s.table === "open" && s.mine) {
    button = (
      <button type="button" onClick={() => setMenu(true)} className={`${btnPrimary} h-14 shrink-0 px-4`}>
        <BellIcon size={20} /> {d.callWaiter.split(" ")[0]}
      </button>
    );
  } else if (s.table === "pending" && s.mine) {
    const wait = s.nextCallAt ? new Date(s.nextCallAt).getTime() - tc.now : null;
    const canRepeat = wait !== null && wait <= 0;
    button = (
      <button type="button" disabled={!canRepeat || busy} onClick={() => send("waiter")}
        className={`${canRepeat ? btnPrimary : btnSecondary} h-14 shrink-0 flex-col gap-0 px-3 text-sm leading-tight`}>
        <span>{fill(d.callN, { n: s.attempts, max: s.maxAttempts })}</span>
        <span className="text-xs font-semibold opacity-80">
          {canRepeat ? d.callAgain : wait !== null ? fill(d.nextCallIn, { t: countdown(wait) }) : d.callSent}
        </span>
      </button>
    );
  } else {
    button = (
      <button type="button" disabled={busy} onClick={() => send("waiter")} className={`${btnPrimary} h-14 shrink-0 px-4`}>
        <BellIcon size={20} /> {d.callWaiter.split(" ")[0]}
      </button>
    );
  }

  return (
    <>
      {button}
      <StatusLine tc={tc} lang={lang} flash={flash} />
      {/* Portal: the bar's backdrop blur would otherwise trap the fixed sheet. */}
      {menu && s && createPortal(<OpenTableSheet tc={tc} lang={lang} selection={selection} onClose={() => setMenu(false)} />, document.body)}
    </>
  );
}

// A short line above the bottom bar: who serves the table, notices, results.
function StatusLine({ tc, lang, flash }: { tc: TC; lang: Lang; flash: string | null }) {
  const d = t(lang);
  const s = tc.state;
  let text: string | null = flash;
  let tone = "border-line text-text";
  if (!text && tc.notice === "noResponse") {
    text = d.noResponse;
    tone = "border-danger/50 text-danger";
  } else if (!text && s && !s.venueOpen) text = d.closedHours;
  else if (!text && s?.table === "open") {
    const requested = s.activeCalls.filter((c) => c.status === "new" && c.type !== "waiter").map((c) => d[c.type as "bill" | "container" | "other"]);
    text = requested.length
      ? `${d.requested}: ${requested.join(", ")}`
      : s.waiterName ? fill(d.waiterIs, { name: s.waiterName }) : d.waiterComing;
    tone = "border-ok/40 text-ok";
  }
  if (!text) return null;
  return (
    <div role="status" onClick={tc.clearNotice}
      className={`absolute inset-x-3 -top-11 rounded-2xl border bg-surface px-3.5 py-2 text-center text-[13px] font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.5)] ${tone}`}>
      {text}
    </div>
  );
}

function OpenTableSheet({ tc, lang, selection, onClose }: { tc: TC; lang: Lang; selection: SelectionApi; onClose: () => void }) {
  const d = t(lang);
  const { busy, flash, send } = useSend(tc, lang, selection);
  const [step, setStep] = useState<"main" | "bill" | "other">("main");
  const [comment, setComment] = useState("");
  const pending = new Set(tc.state?.activeCalls.filter((c) => c.status === "new").map((c) => c.type));

  const go = async (type: CallType, extra: CallExtra = {}) => {
    const r = await send(type, extra);
    if (r === "ok") setTimeout(onClose, 700);
  };

  const tile = "flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-2 text-sm font-bold disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={d.callWaiter} onClick={(e) => e.stopPropagation()}
        className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-t-[26px] bg-surface px-5 pb-7 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-lg font-extrabold">
            {step === "bill" ? d.howToPay : step === "other" ? d.other : tc.state?.waiterName ? fill(d.waiterIs, { name: tc.state.waiterName }) : d.callWaiter}
          </span>
          <button type="button" aria-label={d.close} onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2">
            <CloseIcon size={18} />
          </button>
        </div>

        {step === "main" && (
          <>
            <button type="button" disabled={busy || pending.has("waiter")} onClick={() => go("waiter", { withSelection: true })} className={`${btnPrimary} h-14`}>
              <BellIcon size={20} /> {selection.items.length ? d.callWithSelection : d.callWaiter}
            </button>
            <div className="grid grid-cols-3 gap-2.5">
              <button type="button" disabled={busy || pending.has("bill")} onClick={() => setStep("bill")} className={tile}>
                <ReceiptIcon className="text-accent" /> {d.bill}
              </button>
              <button type="button" disabled={busy || pending.has("container")} onClick={() => go("container")} className={tile}>
                <BagIcon className="text-accent" /> {d.container}
              </button>
              <button type="button" disabled={busy} onClick={() => setStep("other")} className={tile}>
                <ChatIcon className="text-accent" /> {d.other}
              </button>
            </div>
          </>
        )}

        {step === "bill" && (
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" disabled={busy} onClick={() => go("bill", { payment: "cash" })} className={`${btnSecondary} h-14`}>{d.billCash}</button>
            <button type="button" disabled={busy} onClick={() => go("bill", { payment: "card" })} className={`${btnSecondary} h-14`}>{d.billCard}</button>
          </div>
        )}

        {step === "other" && (
          <form className="flex flex-col gap-2.5" onSubmit={(e) => { e.preventDefault(); if (comment.trim()) go("other", { comment: comment.trim() }); }}>
            <input autoFocus value={comment} onChange={(e) => setComment(e.target.value)} maxLength={200} placeholder={d.otherPlaceholder} aria-label={d.otherPlaceholder}
              className="h-12 rounded-xl border border-line bg-bg px-3.5 outline-none placeholder:text-muted focus:border-accent" />
            <button type="submit" disabled={busy || !comment.trim()} className={`${btnPrimary} h-14`}>{d.send}</button>
          </form>
        )}

        {flash && <p role="status" className="text-center text-sm font-semibold text-muted">{flash}</p>}
      </div>
    </div>
  );
}

// Inside "My selection": call the waiter and pass the selection along.
function SheetActions({ tc, lang, selection }: { tc: TC; lang: Lang; selection: SelectionApi }) {
  const d = t(lang);
  const { busy, flash, send } = useSend(tc, lang, selection);
  const s = tc.state;
  const pendingMine = s?.table === "pending" && s.mine;
  const wait = pendingMine && s.nextCallAt ? new Date(s.nextCallAt).getTime() - tc.now : null;
  const disabled = busy || !s?.venueOpen || (pendingMine && (wait === null || wait > 0));
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => send("waiter", { withSelection: true })} className={`${btnPrimary} h-14`}>
        <BellIcon size={20} />
        {pendingMine && wait !== null && wait > 0 ? fill(d.nextCallIn, { t: countdown(wait) }) : selection.items.length ? d.callWithSelection : d.callWaiter}
      </button>
      <p className="text-center text-xs text-muted">{flash ?? (s && !s.venueOpen ? d.closedHours : d.notAnOrder)}</p>
    </>
  );
}
