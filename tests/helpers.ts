import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { seedDemo } from "@/db/seed";

export async function resetDb() {
  const { rows } = await db().execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  const names = rows.map((r) => `"${r.tablename}"`).join(", ");
  if (names) await db().execute(sql.raw(`truncate ${names} restart identity cascade`));
}

export async function freshDemo() {
  await resetDb();
  return seedDemo(db());
}
