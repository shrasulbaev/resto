import { describe, expect, it } from "vitest";
import { env } from "@/lib/env";

describe("env", () => {
  it("loads the test configuration", () => {
    expect(env().DATABASE_URL).toContain("resto_test");
  });
});
