import { describe, expect, it } from "vitest";
import { DIFFICULTIES, DIFFICULTY_LABEL } from "./task";

describe("DIFFICULTIES", () => {
  // The order is the sort order and the order on screen. lib/sort.test.ts checks the sorting.
  it("lists low, med and high, easiest first", () => {
    expect([...DIFFICULTIES]).toEqual(["low", "med", "high"]);
  });
});

describe("DIFFICULTY_LABEL", () => {
  // That every difficulty has a label is checked by the compiler, through its Record type.
  it("names each difficulty with its own non-empty label", () => {
    const labels = DIFFICULTIES.map((difficulty) => DIFFICULTY_LABEL[difficulty]);
    expect(labels).toEqual(["Low", "Medium", "High"]);
    for (const label of labels) expect(label.trim()).not.toBe("");
    expect(new Set(labels).size).toBe(DIFFICULTIES.length);
  });
});
