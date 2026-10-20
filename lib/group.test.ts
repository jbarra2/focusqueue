import { describe, expect, it } from "vitest";
import { findGroup, firstFreeColor, slotFor, slotLookup } from "./group";

describe("findGroup", () => {
  const groups = [
    { name: "Home", color: 3 },
    { name: "Errands", color: 8 },
  ];

  it("returns the stored group, matching without case", () => {
    expect(findGroup(groups, "hOmE")).toEqual({ name: "Home", color: 3 });
    expect(findGroup(groups, "Errands")).toEqual({ name: "Errands", color: 8 });
  });

  it("is undefined for an unknown name or an empty list", () => {
    expect(findGroup(groups, "Nowhere")).toBeUndefined();
    expect(findGroup([], "Home")).toBeUndefined();
  });

  it("folds only English letters, as the database does", () => {
    const accented = [{ name: "Éclair", color: 2 }];
    expect(findGroup(accented, "ÉCLAIR")?.color).toBe(2);
    expect(findGroup(accented, "éclair")).toBeUndefined();
  });
});

describe("slotFor", () => {
  const groups = [
    { name: "Home", color: 3 },
    { name: "Errands", color: 8 },
  ];

  it("finds the slot of a group, matching without case", () => {
    expect(slotFor(groups, "Home")).toBe(3);
    expect(slotFor(groups, "hOmE")).toBe(3);
    expect(slotFor(groups, "Errands")).toBe(8);
  });

  it("folds only English letters, as the database does", () => {
    const accented = [
      { name: "Éclair", color: 2 },
      { name: "éclair", color: 6 },
    ];
    expect(slotFor(accented, "Éclair")).toBe(2);
    expect(slotFor(accented, "éclair")).toBe(6);
    // The English letters fold and the É stays, so this is the first group, not the second.
    expect(slotFor(accented, "ÉCLAIR")).toBe(2);
  });

  it("is null for no group or an unknown group", () => {
    expect(slotFor(groups, null)).toBeNull();
    expect(slotFor(groups, "Nowhere")).toBeNull();
    expect(slotFor([], "Home")).toBeNull();
  });

  it("is null for a slot outside 1 to 8", () => {
    for (const color of [0, 9, -1, 1.5, Number.NaN]) {
      expect(slotFor([{ name: "Odd", color }], "Odd")).toBeNull();
    }
  });
});

describe("slotLookup", () => {
  // The database never holds two groups whose names differ only in English letter case, nor a slot
  // outside 1 to 8. They are here so the rules are pinned down for any list.
  const groups = [
    { name: "Home", color: 3 },
    { name: "Errands", color: 8 },
    { name: "Éclair", color: 2 },
    { name: "éclair", color: 6 },
    { name: "Odd", color: 9 },
    { name: "Same", color: 4 },
    { name: "SAME", color: 5 },
    { name: "First", color: 0 },
    { name: "FIRST", color: 7 },
  ];

  it("finds the slot of a group without case, and folds only English letters", () => {
    const lookup = slotLookup(groups);
    expect(lookup("hOmE")).toBe(3);
    expect(lookup("ERRANDS")).toBe(8);
    expect(lookup("éclair")).toBe(6);
    expect(lookup("ÉCLAIR")).toBe(2);
  });

  it("uses the first group of a name, even when its slot is not valid", () => {
    const lookup = slotLookup(groups);
    expect(lookup("same")).toBe(4);
    expect(lookup("SAME")).toBe(4);
    expect(lookup("first")).toBeNull();
  });

  it("is null for no group, an unknown group, a slot outside 1 to 8, and an empty list", () => {
    const lookup = slotLookup(groups);
    expect(lookup(null)).toBeNull();
    expect(lookup("Nowhere")).toBeNull();
    expect(lookup("Odd")).toBeNull();
    expect(slotLookup([])("Home")).toBeNull();
  });
});

describe("firstFreeColor", () => {
  it("is 1 when no color is taken", () => {
    expect(firstFreeColor([])).toBe(1);
  });

  it("is the lowest slot that is free, wherever the gap is", () => {
    expect(firstFreeColor([1, 2])).toBe(3);
    expect(firstFreeColor([1, 3])).toBe(2);
    expect(firstFreeColor([2, 3])).toBe(1);
    expect(firstFreeColor([1, 2, 3, 4, 5, 6, 7])).toBe(8);
  });

  it("is null when all 8 colors are taken", () => {
    expect(firstFreeColor([1, 2, 3, 4, 5, 6, 7, 8])).toBeNull();
  });

  it("takes a set or a list, in any order, with repeats", () => {
    expect(firstFreeColor(new Set([2, 1]))).toBe(3);
    expect(firstFreeColor([3, 1, 3, 2])).toBe(4);
  });

  it("is not changed by a color outside the 8 slots", () => {
    expect(firstFreeColor([0, 9, -1, 1.5])).toBe(1);
    expect(firstFreeColor([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBeNull();
  });
});
