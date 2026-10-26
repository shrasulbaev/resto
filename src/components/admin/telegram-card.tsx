"use client";

import { useState, useTransition } from "react";
import { telegramCodeAction, telegramUnlinkAction } from "@/app/actions/admin-venue";
import { btnSecondary } from "@/lib/ui";

export function TelegramCard({ enabled, linked, bot, code: initialCode }: { enabled: boolean; linked: boolean; bot: string | null; code: string | null }) {
  const [code, setCode] = useState(initialCode);
  const [pending, start] = useTransition();
  return (
    <section className="flex max-w-2xl flex-col gap-3 rounded-2xl bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-extrabold">Telegram-журнал</h2>
        <p className="text-sm text-muted">Запасной журнал: бот пишет в ваш чат каждый закрытый счёт и столы, к которым никто не подошёл.</p>
      </div>
      {!enabled ? (
        <p className="text-sm text-warn">Бот не настроен на сервере (нет TELEGRAM_BOT_TOKEN).</p>
      ) : linked ? (
        <div className="flex items-center gap-3">
          <span className="flex-1 text-sm font-semibold text-ok">Чат подключён</span>
          <button type="button" disabled={pending} onClick={() => start(async () => { await telegramUnlinkAction(); setCode(null); })} className={`${btnSecondary} h-10 text-sm`}>Отключить</button>
        </div>
      ) : code ? (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
          <li>Откройте {bot ? <a href={`https://t.me/${bot}`} target="_blank" rel="noreferrer" className="font-bold text-accent">@{bot}</a> : "бота"} или добавьте его в группу.</li>
          <li>Отправьте: <code className="rounded-lg bg-bg px-2 py-0.5 font-bold">/link {code}</code></li>
          <li>Обновите эту страницу.</li>
        </ol>
      ) : (
        <button type="button" disabled={pending} onClick={() => start(async () => setCode(await telegramCodeAction()))} className={`${btnSecondary} h-10 self-start text-sm`}>
          Подключить чат
        </button>
      )}
    </section>
  );
}
