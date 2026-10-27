// Bundled into dist/seed-demo.mjs for the production image, where it seeds
// the demo venue on first start when SEED_DEMO=1 (test servers only).
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@/db/schema";
import { seedDemo } from "@/db/seed";

export async function run(connectionString: string) {
  const pool = new pg.Pool({ connectionString });
  const { rows } = await pool.query("select 1 from venues limit 1");
  if (rows.length === 0) {
    const venue = await seedDemo(drizzle(pool, { schema }));
    console.log(`demo venue created: ${venue.name}`);
  }
  await pool.end();
}
