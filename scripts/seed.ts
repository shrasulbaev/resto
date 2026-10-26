import "dotenv/config";
import { db, pool } from "@/db/client";
import { seedDemo, DEMO } from "@/db/seed";

async function main() {
  const venue = await seedDemo(db());
  console.log(`Demo venue created: ${venue.name} (/${venue.slug})`);
  console.log(`Owner login: ${DEMO.ownerEmail} / ${DEMO.ownerPassword}`);
  console.log(`Waiter PINs: ${Object.entries(DEMO.waiterPins).map(([n, p]) => `${n} ${p}`).join(", ")}; kitchen ${DEMO.kitchenPin}`);
  await pool().end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
