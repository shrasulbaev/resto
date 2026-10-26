// Production entrypoint: apply migrations, create the platform admin on the
// very first start, then run the Next.js server.
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

for (let i = 1; ; i++) {
  try {
    await pool.query("select 1");
    break;
  } catch (e) {
    if (i >= 30) throw e;
    console.log("waiting for database…");
    await new Promise((r) => setTimeout(r, 2000));
  }
}

await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
console.log("migrations applied");

const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.PLATFORM_ADMIN_PASSWORD;
if (email && password) {
  const { rows } = await pool.query("select 1 from users where role = 'platform' limit 1");
  if (rows.length === 0) {
    await pool.query("insert into users (email, password_hash, name, role) values ($1, $2, 'Platform', 'platform')", [email, await bcrypt.hash(password, 10)]);
    console.log(`platform admin created: ${email}`);
  }
}
await pool.end();

await import("../server.js");
