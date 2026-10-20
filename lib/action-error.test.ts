import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { GENERIC_ACTION_ERROR, toActionError } from "./action-error";
import { COLOR_TAKEN_MESSAGE, GROUP_LIMIT_MESSAGE, taskInputSchema } from "./task-schema";
import { GroupError } from "./tasks";

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("toActionError", () => {
  it("gives the first message of a schema error, which is the field to fix first", () => {
    const result = taskInputSchema.safeParse({ name: "", dueDate: "nope", difficulty: "hard" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(toActionError(result.error)).toBe("Enter a name.");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("gives a schema error with no issues the generic sentence", () => {
    expect(toActionError(new z.ZodError([]))).toBe(GENERIC_ACTION_ERROR);
  });

  it.each([GROUP_LIMIT_MESSAGE, COLOR_TAKEN_MESSAGE])(
    "passes a group sentence on as it is",
    (m) => {
      expect(toActionError(new GroupError(m))).toBe(m);
      expect(consoleError).not.toHaveBeenCalled();
    },
  );

  it("logs anything else and gives one generic sentence, never its own text", () => {
    const secret = "SqliteError: no such table: task at C:\\somewhere\\data\\focusqueue.sqlite";
    const error = new Error(secret);
    const message = toActionError(error);
    expect(message).toBe(GENERIC_ACTION_ERROR);
    expect(message).not.toContain("Sqlite");
    expect(message).not.toContain("focusqueue");
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]).toContain(error);
  });

  it.each([
    ["a string", "boom"],
    ["undefined", undefined],
    ["null", null],
    ["an object", { a: 1 }],
  ])("gives %s that is thrown the generic sentence", (_label, thrown) => {
    expect(toActionError(thrown)).toBe(GENERIC_ACTION_ERROR);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("keeps the generic sentence to one sentence", () => {
    expect(GENERIC_ACTION_ERROR.match(/[.!?]/g)).toHaveLength(1);
  });
});
