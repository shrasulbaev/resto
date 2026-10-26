import { describe, expect, it } from "vitest";
import { addDish, parseSelection, setQty, totals } from "@/lib/selection";

const menu = new Map([
  ["a", { id: "a", price: 590, kcal: 720 }],
  ["b", { id: "b", price: 190, kcal: 240 }],
]);

describe("selection", () => {
  it("merges the same dish with the same comment", () => {
    let s = addDish([], "a");
    s = addDish(s, "a");
    s = addDish(s, "a", 1, "без лука");
    expect(s).toEqual([{ dishId: "a", qty: 2 }, { dishId: "a", qty: 1, comment: "без лука" }]);
  });

  it("removes an item when qty drops to zero", () => {
    expect(setQty([{ dishId: "a", qty: 1 }], 0, 0)).toEqual([]);
  });

  it("sums price and calories, ignoring dishes no longer on the menu", () => {
    const t = totals([{ dishId: "a", qty: 1 }, { dishId: "b", qty: 2 }, { dishId: "gone", qty: 3 }], menu);
    expect(t).toEqual({ count: 3, sum: 970, kcal: 1200 });
  });

  it("ignores broken stored data", () => {
    expect(parseSelection("not json")).toEqual([]);
    expect(parseSelection('[{"dishId":"a","qty":-1},{"dishId":"b","qty":2}]')).toEqual([{ dishId: "b", qty: 2, comment: undefined }]);
  });
});
