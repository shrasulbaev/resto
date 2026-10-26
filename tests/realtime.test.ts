import { afterAll, describe, expect, it } from "vitest";
import { publish } from "@/server/events";
import { stopListening, subscribe, type VenueMessage } from "@/server/realtime";

const until = async (cond: () => boolean) => {
  for (let i = 0; i < 50 && !cond(); i++) await new Promise((r) => setTimeout(r, 20));
};

describe("realtime hub", () => {
  afterAll(stopListening);

  it("delivers events only to subscribers of the same venue", async () => {
    const a: VenueMessage[] = [];
    const b: VenueMessage[] = [];
    const offA = await subscribe("venue-a", (e) => a.push(e));
    const offB = await subscribe("venue-b", (e) => b.push(e));
    await publish("venue-a", { type: "table", tableId: "t1" });
    await until(() => a.length > 0);
    expect(a).toEqual([{ venueId: "venue-a", type: "table", tableId: "t1" }]);
    expect(b).toEqual([]);
    offA();
    await publish("venue-a", { type: "menu" });
    await publish("venue-b", { type: "menu" });
    await until(() => b.length > 0);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    offB();
  });
});
