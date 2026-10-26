// Runs once per server process. Closes unanswered and idle tables even when
// no guest or waiter is looking at them.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV === "test") return;
  const { sweepAll } = await import("@/server/tables");
  const g = globalThis as unknown as { sweeper?: NodeJS.Timeout };
  if (g.sweeper) return;
  g.sweeper = setInterval(() => {
    sweepAll().catch((e) => console.error("sweep failed", e));
  }, 30_000);
}
