import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { staff, venues } from "@/db/schema";
import { DEMO } from "@/db/seed";
import { signSession, verifySession } from "@/lib/session-token";
import { allowAttempt, authenticateStaff, authenticateUser } from "@/server/auth";
import { freshDemo } from "./helpers";

describe("auth", () => {
  beforeEach(async () => {
    await freshDemo();
  });

  it("logs the owner in with the right password only", async () => {
    const ok = await authenticateUser(DEMO.ownerEmail, DEMO.ownerPassword);
    expect(ok).toMatchObject({ kind: "user", role: "owner" });
    expect(await authenticateUser(DEMO.ownerEmail, "wrong")).toBeNull();
  });

  it("logs a waiter in by PIN within their venue", async () => {
    const [aibek] = await db().select().from(staff).where(eq(staff.name, "Айбек"));
    expect(await authenticateStaff(DEMO.slug, aibek.id, "1111")).toMatchObject({ kind: "staff", role: "waiter" });
    expect(await authenticateStaff(DEMO.slug, aibek.id, "2222")).toBeNull();
  });

  it("rejects staff of one venue logging into another", async () => {
    const [aibek] = await db().select().from(staff).where(eq(staff.name, "Айбек"));
    await db().insert(venues).values({ slug: "other", name: "Другое кафе" });
    expect(await authenticateStaff("other", aibek.id, "1111")).toBeNull();
  });

  it("rejects disabled staff", async () => {
    const [aibek] = await db().select().from(staff).where(eq(staff.name, "Айбек"));
    await db().update(staff).set({ active: false }).where(eq(staff.id, aibek.id));
    expect(await authenticateStaff(DEMO.slug, aibek.id, "1111")).toBeNull();
  });

  it("round-trips a signed session and rejects tampering", async () => {
    const token = await signSession({ kind: "staff", staffId: "s", role: "waiter", venueId: "v" });
    expect(await verifySession(token)).toMatchObject({ staffId: "s", venueId: "v" });
    expect(await verifySession(token.slice(0, -2) + "xx")).toBeNull();
  });

  it("limits repeated attempts", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) expect(allowAttempt("k", 5, 60_000, now)).toBe(true);
    expect(allowAttempt("k", 5, 60_000, now)).toBe(false);
    expect(allowAttempt("k", 5, 60_000, now + 61_000)).toBe(true);
  });
});
