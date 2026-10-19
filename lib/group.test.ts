import { describe, expect, it } from "vitest";
import { findGroup, slotFor } from "./group";

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
