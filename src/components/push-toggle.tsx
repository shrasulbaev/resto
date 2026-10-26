"use client";

import { useEffect, useState } from "react";
import { BellIcon } from "@/components/icons";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// Lets staff turn on notifications on this phone. On iPhone push works only
// from the app added to the Home Screen, so we explain that instead.
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !publicKey) {
        return setState(ios && !standalone ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Re-send so a re-login on this phone moves it to the current person.
        await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) }).catch(() => {});
      }
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [publicKey]);

  const enable = async () => {
    if (!publicKey) return;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
    setState(res.ok ? "on" : "off");
  };

  const disable = async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState("off");
  };

  if (state === "loading" || state === "unsupported") return null;
  if (state === "on") {
    return (
      <button type="button" onClick={disable} className="flex items-center gap-1.5 text-xs font-semibold text-ok">
        <BellIcon size={14} /> Уведомления включены
      </button>
    );
  }
  const hint =
    state === "ios-install" ? "Чтобы получать уведомления на iPhone: «Поделиться» → «На экран Домой», затем откройте приложение с иконки."
    : state === "denied" ? "Уведомления запрещены в настройках браузера для этого сайта. Разрешите их, чтобы не пропускать вызовы."
    : null;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
      {hint ? <p className="text-sm text-text">{hint}</p> : (
        <div className="flex items-center gap-3">
          <p className="flex-1 text-sm">Включите уведомления, чтобы вызовы приходили, даже когда телефон в кармане.</p>
          <button type="button" onClick={enable} className="h-10 shrink-0 rounded-xl bg-accent px-4 text-sm font-extrabold text-accent-ink">Включить</button>
        </div>
      )}
    </div>
  );
}
