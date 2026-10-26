import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { categories, dishes, staff, tables, users } from "@/db/schema";
import { freshDemo } from "./helpers";

describe("demo seed", () => {
  beforeEach(async () => {
    await freshDemo();
  });

  it("creates a venue with menu, tables, staff and owner", async () => {
    expect(await db().select().from(tables)).toHaveLength(10);
    expect(await db().select().from(categories)).toHaveLength(4);
    expect((await db().select().from(dishes)).length).toBeGreaterThanOrEqual(10);
    expect(await db().select().from(staff)).toHaveLength(3);
    const owners = await db().select().from(users).where(eq(users.role, "owner"));
    expect(owners).toHaveLength(1);
  });

  it("gives every table a unique QR token", async () => {
    const tokens = (await db().select().from(tables)).map((t) => t.token);
    expect(new Set(tokens).size).toBe(tokens.length);
  });
});
