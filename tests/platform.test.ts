import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { authenticateUser } from "@/server/auth";
import { findTableByToken } from "@/server/menu";
import { createVenue, ensurePlatformAdmin, platformVenues, resetOwnerPassword, setVenueActive } from "@/server/platform";
import { resetDb } from "./helpers";

describe("platform", () => {
  beforeEach(resetDb);

  it("creates a venue with its owner and tables", async () => {
    const r = await createVenue({ name: "Чайхана №1", slug: "Chaikhana-1", ownerEmail: "Owner@x.kg", ownerPassword: "secret123", tables: 3 });
    expect(r.ok).toBe(true);
    const list = await platformVenues();
    expect(list).toEqual([expect.objectContaining({ name: "Чайхана №1", slug: "chaikhana-1", tables: 3, owners: ["owner@x.kg"] })]);
    const s = await authenticateUser("owner@x.kg", "secret123");
    expect(s).toMatchObject({ kind: "user", role: "owner" });
  });

  it("refuses duplicates and bad slugs", async () => {
    await createVenue({ name: "A", slug: "aaa", ownerEmail: "a@x.kg", ownerPassword: "secret123" });
    expect(await createVenue({ name: "B", slug: "aaa", ownerEmail: "b@x.kg", ownerPassword: "secret123" })).toMatchObject({ error: "slug_taken" });
    expect(await createVenue({ name: "B", slug: "bbb", ownerEmail: "a@x.kg", ownerPassword: "secret123" })).toMatchObject({ error: "email_taken" });
    expect(await createVenue({ name: "B", slug: "b b", ownerEmail: "c@x.kg", ownerPassword: "secret123" })).toMatchObject({ ok: false });
  });

  it("deactivating a venue hides its menu", async () => {
    const r = await createVenue({ name: "A", slug: "aaa", ownerEmail: "a@x.kg", ownerPassword: "secret123", tables: 1 });
    if (!r.ok) throw new Error();
    const { tables } = await import("@/db/schema");
    const [t] = await db().select().from(tables);
    expect(await findTableByToken(t.token)).not.toBeNull();
    await setVenueActive(r.venue.id, false);
    expect(await findTableByToken(t.token)).toBeNull();
  });

  it("bootstraps the platform admin once and resets owner passwords", async () => {
    expect(await ensurePlatformAdmin("root@x.kg", "rootroot1")).toBe(true);
    expect(await ensurePlatformAdmin("other@x.kg", "rootroot1")).toBe(false);
    expect(await db().select().from(users).where(eq(users.role, "platform"))).toHaveLength(1);
    await createVenue({ name: "A", slug: "aaa", ownerEmail: "a@x.kg", ownerPassword: "secret123" });
    expect(await resetOwnerPassword("a@x.kg", "newpass12")).toBe(true);
    expect(await authenticateUser("a@x.kg", "newpass12")).not.toBeNull();
    expect(await resetOwnerPassword("root@x.kg", "newpass12")).toBe(false);
  });
});
