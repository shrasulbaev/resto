// Runs once per server process: background sweep of tables, push
// notifications and the Telegram journal.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV === "test") return;
  const g = globalThis as unknown as { backgroundStarted?: boolean };
  if (g.backgroundStarted) return;
  g.backgroundStarted = true;

  const { sweepAll } = await import("@/server/tables");
  const { extraHandlers, startNotifier } = await import("@/server/notify");
  const { journal, startTelegramPolling } = await import("@/server/telegram");

  extraHandlers.push(journal);
  startNotifier().catch((e) => console.error("notifier failed to start", e));
  void startTelegramPolling();
  setInterval(() => {
    sweepAll().catch((e) => console.error("sweep failed", e));
  }, 30_000);
}
