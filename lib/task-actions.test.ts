import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "better-sqlite3";
import { GENERIC_ACTION_ERROR } from "./action-error";
import { openDatabase } from "./db";
import { COLOR_TAKEN_MESSAGE, GROUP_LIMIT_MESSAGE } from "./task-schema";
import { addTask, type AddTaskResult } from "./task-actions";
import { listGroups, listTasks } from "./tasks";

// Made-up task data on a database in memory, never the real one.

let db: Database;
let openDb: () => Database;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  db = openDatabase(":memory:");
  openDb = vi.fn(() => db);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

const VALID = {
  name: "Made-up report",
  group: "Made-up group",
  description: "Chapters 1 and 2",
  dueDate: "2026-10-23",
  difficulty: "med",
};

function form(fields: Record<string, string | Blob | undefined> = {}): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...VALID, ...fields })) {
    if (value !== undefined) data.set(key, value);
  }
  return data;
}

function count(): number {
  return (db.prepare("SELECT count(*) AS n FROM task").get() as { n: number }).n;
}

function refused(result: AddTaskResult): string {
  expect(result.ok).toBe(false);
  return result.ok ? "" : result.message;
}

describe("addTask", () => {
  it("adds a task and gives back only its id", () => {
    const result = addTask(openDb, form());
    expect(result).toEqual({ ok: true, id: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    const [task] = listTasks(db);
    expect(task).toMatchObject({
      name: "Made-up report",
      group: "Made-up group",
      description: "Chapters 1 and 2",
      dueDate: "2026-10-23",
      difficulty: "med",
      completedAt: null,
    });
    expect(result.ok && result.id).toBe(task.id);
  });

  it("adds a task with no group and no description", () => {
    expect(addTask(openDb, form({ group: undefined, description: undefined })).ok).toBe(true);
    expect(listTasks(db)[0]).toMatchObject({ group: null, description: "" });
    expect(listGroups(db)).toEqual([]);
  });

  it("treats an empty group as no group", () => {
    expect(addTask(openDb, form({ group: "  " })).ok).toBe(true);
    expect(listTasks(db)[0].group).toBeNull();
  });

  it("gives a new group the color that was chosen", () => {
    expect(addTask(openDb, form({ groupColor: "5" })).ok).toBe(true);
    expect(listGroups(db)).toEqual([{ name: "Made-up group", color: 5 }]);
  });

  it("treats an empty color as none, and gives the first free one", () => {
    expect(addTask(openDb, form({ groupColor: "" })).ok).toBe(true);
    expect(listGroups(db)).toEqual([{ name: "Made-up group", color: 1 }]);
  });

  it("gives a new group the first free color when none was chosen", () => {
    addTask(openDb, form({ group: "One", groupColor: "1" }));
    addTask(openDb, form({ group: "Two" }));
    expect(listGroups(db)).toEqual([
      { name: "One", color: 1 },
      { name: "Two", color: 2 },
    ]);
  });

  it("matches an existing group without case and ignores a color sent with it", () => {
    addTask(openDb, form({ group: "Made-up group", groupColor: "3" }));
    expect(addTask(openDb, form({ group: "MADE-UP GROUP", groupColor: "7" })).ok).toBe(true);
    expect(listGroups(db)).toEqual([{ name: "Made-up group", color: 3 }]);
    expect(listTasks(db).map((t) => t.group)).toEqual(["Made-up group", "Made-up group"]);
  });

  it("refuses a color another group uses, with its sentence, and writes nothing", () => {
    addTask(openDb, form({ group: "One", groupColor: "4" }));
    const before = count();
    expect(refused(addTask(openDb, form({ group: "Two", groupColor: "4" })))).toBe(
      COLOR_TAKEN_MESSAGE,
    );
    expect(count()).toBe(before);
    expect(listGroups(db)).toHaveLength(1);
  });

  it("refuses a ninth group with the limit sentence, and writes nothing", () => {
    for (let n = 1; n <= 8; n += 1) addTask(openDb, form({ group: `Group ${n}` }));
    expect(listGroups(db)).toHaveLength(8);
    expect(refused(addTask(openDb, form({ group: "Group 9" })))).toBe(GROUP_LIMIT_MESSAGE);
    expect(count()).toBe(8);
    expect(listGroups(db)).toHaveLength(8);
  });

  it("still adds to an existing group when all 8 colors are taken", () => {
    for (let n = 1; n <= 8; n += 1) addTask(openDb, form({ group: `Group ${n}` }));
    expect(addTask(openDb, form({ group: "group 3" })).ok).toBe(true);
    expect(count()).toBe(9);
  });

  it.each([
    ["no name", { name: undefined }, "Enter a name."],
    ["a name of only spaces", { name: "   " }, "Enter a name."],
    ["a name of only zero-width spaces", { name: "\u200B\u200B" }, "Enter a name."],
    ["a name that is too long", { name: "x".repeat(201) }, "Keep the name under 200 characters."],
    ["a name that is a file", { name: new Blob(["x"]) }, "Enter a name."],
    ["no due date", { dueDate: undefined }, "Enter a due date."],
    ["a date that does not exist", { dueDate: "2026-02-30" }, "Enter a due date."],
    ["a date without padding", { dueDate: "2026-2-3" }, "Enter a due date."],
    ["no difficulty", { difficulty: undefined }, "Choose a difficulty."],
    ["a difficulty that is not one of the three", { difficulty: "hard" }, "Choose a difficulty."],
    [
      "a group of only zero-width spaces",
      { group: "\u200B" },
      "Enter a group name, or leave the group empty.",
    ],
    [
      "a group that is too long",
      { group: "g".repeat(101) },
      "Keep the group under 100 characters.",
    ],
    ["a color outside the slots", { groupColor: "9" }, "Choose one of the group colors."],
    ["a color that is not a number", { groupColor: "red" }, "Choose one of the group colors."],
    ["a color with a sign", { groupColor: "-1" }, "Choose one of the group colors."],
    ["a color with a fraction", { groupColor: "1.5" }, "Choose one of the group colors."],
    ["a color written in hex", { groupColor: "0x3" }, "Choose one of the group colors."],
    ["a color written with an exponent", { groupColor: "1e0" }, "Choose one of the group colors."],
    ["a color with a space", { groupColor: " 3" }, "Choose one of the group colors."],
    ["a color with too many digits", { groupColor: "003" }, "Choose one of the group colors."],
    [
      "a description that is too long",
      { description: "d".repeat(2001) },
      "Keep the description under 2000 characters.",
    ],
  ])("refuses %s with one sentence, and writes nothing", (_label, fields, sentence) => {
    expect(refused(addTask(openDb, form(fields)))).toBe(sentence);
    expect(count()).toBe(0);
    expect(listGroups(db)).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("gives the first problem when there are several", () => {
    const message = refused(addTask(openDb, form({ name: "", dueDate: "nope", difficulty: "x" })));
    expect(message).toBe("Enter a name.");
  });

  it("does not open the database for input that is not valid", () => {
    addTask(openDb, form({ name: "" }));
    addTask(openDb, new FormData());
    addTask(openDb, "not a form");
    expect(openDb).not.toHaveBeenCalled();
  });

  it.each([
    ["a string", "name=Robert"],
    ["a plain object", { name: "Made-up", dueDate: "2026-10-23", difficulty: "low" }],
    ["null", null],
    ["undefined", undefined],
    ["a number", 7],
  ])("refuses %s in place of the form, with the generic sentence", (_label, notAForm) => {
    expect(refused(addTask(openDb, notAForm))).toBe(GENERIC_ACTION_ERROR);
    expect(count()).toBe(0);
    expect(openDb).not.toHaveBeenCalled();
  });

  it("reads only the fields it knows, so extra ones cannot set anything", () => {
    const sneaky = form({
      id: "00000000-0000-4000-8000-000000000000",
      createdAt: "1999-01-01T00:00:00.000Z",
      completedAt: "2026-10-19T08:00:00.000Z",
      completed_at: "2026-10-19T08:00:00.000Z",
      group_name: "Elsewhere",
    });
    const result = addTask(openDb, sneaky);
    expect(result.ok).toBe(true);
    const [task] = listTasks(db);
    expect(task.id).not.toBe("00000000-0000-4000-8000-000000000000");
    expect(task.completedAt).toBeNull();
    expect(task.createdAt).not.toBe("1999-01-01T00:00:00.000Z");
    expect(task.group).toBe("Made-up group");
    expect(listGroups(db).map((g) => g.name)).toEqual(["Made-up group"]);
  });

  it("uses the first value of a field that is sent twice, as FormData.get does", () => {
    const twice = form();
    twice.append("name", "Second");
    expect(addTask(openDb, twice).ok).toBe(true);
    expect(listTasks(db)[0].name).toBe("Made-up report");
  });

  it("stores text that looks like SQL or markup as plain text", () => {
    const name = `Robert'); DROP TABLE task; -- <b>bold</b> & more`;
    expect(addTask(openDb, form({ name })).ok).toBe(true);
    expect(listTasks(db).map((t) => t.name)).toEqual([name]);
    expect(count()).toBe(1);
  });

  it("gives the generic sentence and logs when the database fails, and leaks nothing", () => {
    db.close();
    const message = refused(addTask(openDb, form()));
    expect(message).toBe(GENERIC_ACTION_ERROR);
    expect(message).not.toMatch(/closed|sqlite|database/i);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("gives the generic sentence when the database cannot be opened", () => {
    const broken = vi.fn(() => {
      throw new Error("unable to open database file C:\\private\\data\\focusqueue.sqlite");
    });
    const message = refused(addTask(broken, form()));
    expect(message).toBe(GENERIC_ACTION_ERROR);
    expect(message).not.toContain("private");
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
