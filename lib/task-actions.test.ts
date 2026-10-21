import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "better-sqlite3";
import { GENERIC_ACTION_ERROR } from "./action-error";
import { openDatabase } from "./db";
import { COLOR_TAKEN_MESSAGE, GROUP_LIMIT_MESSAGE, taskInputSchema } from "./task-schema";
import {
  addTask,
  clearOldCompletedTasks,
  deleteTaskById,
  markDoneTask,
  markOpenTask,
  TASK_GONE_MESSAGE,
  updateTaskFromForm,
  type AddTaskResult,
} from "./task-actions";
import { createTask, listGroups, listTasks } from "./tasks";

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
    // The server's log gets one line, which says what kind of request it was and nothing else.
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0][0])).toContain("not form data");
  });

  // The form only ever sends text, so a file under one of its fields can only come from a
  // hand-made request. There is no sentence a person could act on, so the answer is the generic
  // one for every field, the database is not opened, and the log gets one line without the file.
  // The fields come from the task schema, so a field added there and left out of the check fails.
  it.each(Object.keys(taskInputSchema.shape))(
    "refuses a file in the %s field with the generic sentence, and never opens the database",
    (field) => {
      const file = new File(["made-up file content"], "made-up-name.txt");
      expect(refused(addTask(openDb, form({ [field]: file })))).toBe(GENERIC_ACTION_ERROR);
      expect(count()).toBe(0);
      expect(listGroups(db)).toEqual([]);
      expect(openDb).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledTimes(1);
      const line = String(consoleError.mock.calls[0][0]);
      expect(line).toContain(`the ${field} field`);
      expect(line).not.toContain("made-up file content");
      expect(line).not.toContain("made-up-name.txt");
    },
  );

  it("refuses a file sent as a second value of a field, though the first value is text", () => {
    const second = form();
    second.append("description", new Blob(["x"]));
    expect(refused(addTask(openDb, second))).toBe(GENERIC_ACTION_ERROR);
    expect(count()).toBe(0);
    expect(openDb).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("does not look at a file under a field it does not read", () => {
    expect(addTask(openDb, form({ attachment: new Blob(["x"]) })).ok).toBe(true);
    expect(count()).toBe(1);
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

describe("markDoneTask and markOpenTask", () => {
  const NOW = "2026-10-14T15:00:00.000Z";
  const MISSING_ID = "00000000-0000-4000-8000-000000000000";

  function add(name = "Made-up report"): string {
    const result = addTask(openDb, form({ name }));
    if (!result.ok) throw new Error(result.message);
    return result.id;
  }

  const completedAt = (id: string) => listTasks(db).find((t) => t.id === id)?.completedAt;

  it("marks a task done at the given time, and gives back nothing but that it worked", () => {
    const id = add();
    expect(markDoneTask(openDb, id, NOW)).toEqual({ ok: true });
    expect(completedAt(id)).toBe(NOW);
  });

  it("keeps the first completion time when a task is marked done again", () => {
    const id = add();
    markDoneTask(openDb, id, NOW);
    expect(markDoneTask(openDb, id, "2026-10-15T09:00:00.000Z")).toEqual({ ok: true });
    expect(completedAt(id)).toBe(NOW);
  });

  it("marks a done task open again, and only that task", () => {
    const id = add();
    const other = add("Another made-up report");
    markDoneTask(openDb, id, NOW);
    markDoneTask(openDb, other, NOW);
    expect(markOpenTask(openDb, id)).toEqual({ ok: true });
    expect(completedAt(id)).toBeNull();
    expect(completedAt(other)).toBe(NOW);
  });

  // The task may have been deleted in another tab. The page is told to draw itself again, which is
  // what the gone flag is for, and the sentence says so.
  it.each([
    ["done", markDoneTask],
    ["open", markOpenTask],
  ])("says a task that is gone is gone when it is marked %s", (_label, write) => {
    expect(write(openDb, MISSING_ID)).toEqual({
      ok: false,
      message: TASK_GONE_MESSAGE,
      gone: true,
    });
    expect(TASK_GONE_MESSAGE).toBe("That task is no longer here, so the page has been refreshed.");
  });

  // Only a hand-made request can send these, because the page sends the id of a card it drew.
  it.each([
    ["nothing", undefined],
    ["null", null],
    ["a number", 5],
    ["an object", { id: "x" }],
    ["a list", ["00000000-0000-4000-8000-000000000000"]],
    ["empty text", ""],
    ["text that is not an id", "not-a-task-id"],
    ["SQL", "'; DROP TABLE task; --"],
    ["an id that is one character short", "00000000-0000-4000-8000-00000000000"],
  ])("refuses %s as the id, without opening the database, and logs nothing of it", (_l, id) => {
    for (const write of [markDoneTask, markOpenTask]) {
      consoleError.mockClear();
      expect(write(openDb, id)).toEqual({ ok: false, message: GENERIC_ACTION_ERROR });
      expect(openDb).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(String(consoleError.mock.calls[0])).not.toContain("DROP");
      expect(String(consoleError.mock.calls[0])).not.toContain("not-a-task-id");
    }
  });

  it("gives the generic sentence, and shows no path, when the database cannot be opened", () => {
    const broken = () => {
      throw new Error("unable to open database file C:\\private\\focusqueue.sqlite");
    };
    for (const result of [markDoneTask(broken, MISSING_ID), markOpenTask(broken, MISSING_ID)]) {
      expect(result).toEqual({ ok: false, message: GENERIC_ACTION_ERROR });
    }
    // The details go to the server's log, one line for each of the two writes.
    expect(consoleError).toHaveBeenCalledTimes(2);
  });

  it("gives the generic sentence when the write fails, and changes nothing", () => {
    const id = add();
    db.exec(
      `CREATE TRIGGER fail_update BEFORE UPDATE ON task
       BEGIN SELECT RAISE(ABORT, 'update failed on C:\\private'); END`,
    );
    const result = markDoneTask(openDb, id, NOW);
    expect(result).toEqual({ ok: false, message: GENERIC_ACTION_ERROR });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(completedAt(id)).toBeNull();
  });
});

describe("clearOldCompletedTasks", () => {
  // Wednesday the 14th, so the week began on Monday the 12th.
  const NOW = new Date(2026, 9, 14, 12);
  const at = (d: number, month = 9) => new Date(2026, month, d, 12).toISOString();

  function done(name: string, completedAt: string, group?: string): string {
    const result = addTask(openDb, form({ name, group }));
    if (!result.ok) throw new Error(result.message);
    markDoneTask(openDb, result.id, completedAt);
    return result.id;
  }

  const names = () => listTasks(db).map((t) => t.name);

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deletes the tasks completed before this week, and says how many", () => {
    done("old", at(8), "Gone");
    done("older", at(1, 8), "Gone");
    done("this week", at(13), "Kept");
    expect(clearOldCompletedTasks(openDb, NOW)).toEqual({ ok: true, deleted: 2 });
    expect(names()).toEqual(["this week"]);
    expect(listGroups(db)).toEqual([{ name: "Kept", color: 2 }]);
  });

  it("works out the week from the day it is given, not from the tasks", () => {
    done("sunday before", at(11));
    done("monday", at(12));
    expect(clearOldCompletedTasks(openDb, new Date(2026, 9, 14, 12))).toEqual({
      ok: true,
      deleted: 1,
    });
    expect(clearOldCompletedTasks(openDb, new Date(2026, 9, 19, 0, 1))).toEqual({
      ok: true,
      deleted: 1,
    });
    expect(names()).toEqual([]);
  });

  it("reads the day from the server's own clock when it is not given one", () => {
    done("old", at(8));
    done("this week", at(13));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    expect(clearOldCompletedTasks(openDb)).toEqual({ ok: true, deleted: 1 });
    expect(names()).toEqual(["this week"]);
  });

  it("leaves open tasks alone", () => {
    addTask(openDb, form({ name: "open", dueDate: "2020-01-01" }));
    expect(clearOldCompletedTasks(openDb, NOW)).toEqual({ ok: true, deleted: 0 });
    expect(names()).toEqual(["open"]);
  });

  it("gives the generic sentence when the database cannot be opened", () => {
    const broken = () => {
      throw new Error("unable to open database file C:\\private\\focusqueue.sqlite");
    };
    expect(clearOldCompletedTasks(broken, NOW)).toEqual({
      ok: false,
      message: GENERIC_ACTION_ERROR,
    });
  });

  it("gives the generic sentence, and deletes nothing, when a delete fails part of the way", () => {
    done("first", at(8), "Doomed");
    done("Boom", at(9), "Doomed");
    db.exec(
      `CREATE TRIGGER fail_delete BEFORE DELETE ON task WHEN OLD.name = 'Boom'
       BEGIN SELECT RAISE(ABORT, 'delete failed on C:\\private'); END`,
    );
    const result = clearOldCompletedTasks(openDb, NOW);
    expect(result).toEqual({ ok: false, message: GENERIC_ACTION_ERROR });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(names().sort()).toEqual(["Boom", "first"]);
    expect(listGroups(db)).toHaveLength(1);
  });
});

describe("updateTaskFromForm", () => {
  const MISSING_ID = "00000000-0000-4000-8000-000000000000";
  const FIELDS = ["name", "group", "groupColor", "description", "dueDate", "difficulty"] as const;

  /** A task made straight in the database, so that the action under test is the only one that runs. */
  function made(overrides: Partial<Parameters<typeof createTask>[1]> = {}): string {
    return createTask(db, { ...VALID, ...overrides } as Parameters<typeof createTask>[1]).id;
  }
  const taskOf = (id: string) => listTasks(db).find((t) => t.id === id)!;
  const groupsNow = () => listGroups(db).map((g) => `${g.name}:${g.color}`);

  it("writes every field, gives back only the id, and leaves the rest of the record alone", () => {
    const id = made({ group: "Home" });
    const other = made({ name: "Another made-up report", group: "Work" });
    markDoneTask(openDb, id, "2026-10-14T15:00:00.000Z");
    (openDb as ReturnType<typeof vi.fn>).mockClear();
    const before = taskOf(id);
    const result = updateTaskFromForm(
      openDb,
      id,
      form({
        name: "Pay the rent",
        group: "Work",
        description: "Before the first.",
        dueDate: "2026-11-01",
        difficulty: "high",
      }),
    );
    expect(result).toEqual({ ok: true, id });
    expect(taskOf(id)).toEqual({
      ...before,
      name: "Pay the rent",
      group: "Work",
      description: "Before the first.",
      dueDate: "2026-11-01",
      difficulty: "high",
    });
    // The completion and creation times are not fields of the form, so they cannot be changed by it.
    expect(taskOf(id).completedAt).toBe("2026-10-14T15:00:00.000Z");
    expect(taskOf(id).createdAt).toBe(before.createdAt);
    expect(taskOf(other).name).toBe("Another made-up report");
    expect(taskOf(other).group).toBe("Work");
  });

  it("writes the whole record, so a field that is not sent is emptied and not kept", () => {
    const id = made({ description: "Something to say" });
    expect(updateTaskFromForm(openDb, id, form({ description: undefined })).ok).toBe(true);
    expect(taskOf(id).description).toBe("");
  });

  it("keeps the color of a group that exists, whatever case it is typed in", () => {
    const id = made({ group: "Home" });
    made({ name: "Second", group: "Work" });
    expect(updateTaskFromForm(openDb, id, form({ group: "work" })).ok).toBe(true);
    expect(taskOf(id).group).toBe("Work");
    expect(groupsNow()).toEqual(expect.arrayContaining(["Work:2"]));
  });

  it("gives a new group the color that was chosen, and drops the group it left when it was the last", () => {
    const id = made({ group: "Home" });
    expect(updateTaskFromForm(openDb, id, form({ group: "Errands", groupColor: "5" })).ok).toBe(
      true,
    );
    expect(groupsNow()).toEqual(["Errands:5"]);
  });

  it("clears the group when the field is empty, and frees the color of a group it was the last in", () => {
    const id = made({ group: "Home" });
    expect(updateTaskFromForm(openDb, id, form({ group: "" })).ok).toBe(true);
    expect(taskOf(id).group).toBeNull();
    expect(groupsNow()).toEqual([]);
  });

  it("says a task that is gone is gone, and the page is told by the flag", () => {
    expect(updateTaskFromForm(openDb, MISSING_ID, form())).toEqual({
      ok: false,
      message: TASK_GONE_MESSAGE,
      gone: true,
    });
    expect(count()).toBe(0);
  });

  // Only a hand-made request sends these, because the page sends the id of the card it drew.
  it.each([
    ["nothing", undefined],
    ["null", null],
    ["a number", 5],
    ["an object", { id: "x" }],
    ["a list", [MISSING_ID]],
    ["empty text", ""],
    ["text that is not an id", "not-a-task-id"],
    ["SQL", "'; DROP TABLE task; --"],
  ])("refuses %s as the id, without opening the database, and logs nothing of it", (_l, id) => {
    expect(updateTaskFromForm(openDb, id, form())).toEqual({
      ok: false,
      message: GENERIC_ACTION_ERROR,
    });
    expect(openDb).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0])).toContain("edit a task");
    expect(String(consoleError.mock.calls[0])).not.toContain("DROP");
    expect(String(consoleError.mock.calls[0])).not.toContain("not-a-task-id");
  });

  it.each([
    ["nothing", undefined],
    ["a string", "name=Made-up"],
    ["a plain object", { name: "Made-up" }],
    ["a list", [["name", "Made-up"]]],
  ])("refuses %s in place of the form, without opening the database", (_label, input) => {
    expect(updateTaskFromForm(openDb, MISSING_ID, input)).toEqual({
      ok: false,
      message: GENERIC_ACTION_ERROR,
    });
    expect(openDb).not.toHaveBeenCalled();
    expect(String(consoleError.mock.calls[0])).toContain("not the edit form");
  });

  // A file can only come from a hand-made request. The field is named in the log, never its content.
  it.each(FIELDS)("refuses a file in the %s field, without opening the database", (field) => {
    const id = made();
    (openDb as ReturnType<typeof vi.fn>).mockClear();
    const result = updateTaskFromForm(
      openDb,
      id,
      form({ [field]: new File(["secret contents"], "private-name.txt") }),
    );
    expect(result).toEqual({ ok: false, message: GENERIC_ACTION_ERROR });
    expect(openDb).not.toHaveBeenCalled();
    const logged = String(consoleError.mock.calls[0]);
    expect(logged).toContain(`a file was sent in the ${field} field`);
    expect(logged).not.toContain("secret contents");
    expect(logged).not.toContain("private-name");
    expect(taskOf(id).name).toBe("Made-up report");
  });

  it("refuses a second value of a field that is a file, as it does for Add", () => {
    const id = made();
    (openDb as ReturnType<typeof vi.fn>).mockClear();
    const data = form();
    data.append("name", new File(["x"], "second.txt"));
    expect(updateTaskFromForm(openDb, id, data)).toEqual({
      ok: false,
      message: GENERIC_ACTION_ERROR,
    });
    expect(openDb).not.toHaveBeenCalled();
  });

  it.each([
    ["no name", { name: "" }, "Enter a name."],
    ["a name of invisible characters", { name: "\u200b\u200b" }, "Enter a name."],
    ["a due date that is not a date", { dueDate: "tomorrow" }, "Enter a due date."],
    ["no difficulty", { difficulty: "" }, "Choose a difficulty."],
    ["a difficulty that is not one", { difficulty: "extreme" }, "Choose a difficulty."],
    ["a color outside the slots", { groupColor: "9" }, "Choose one of the group colors."],
    ["a color that is not a number", { groupColor: "red" }, "Choose one of the group colors."],
  ])(
    "gives the schema's sentence for %s, and the database is never opened",
    (_l, fields, sentence) => {
      const id = made();
      (openDb as ReturnType<typeof vi.fn>).mockClear();
      expect(updateTaskFromForm(openDb, id, form(fields))).toEqual({
        ok: false,
        message: sentence,
      });
      expect(openDb).not.toHaveBeenCalled();
      expect(taskOf(id).name).toBe("Made-up report");
    },
  );

  it("refuses a requested color that another group has, and changes nothing", () => {
    made({ group: "A" });
    const id = made({ name: "Second", group: "B" });
    const before = groupsNow();
    expect(updateTaskFromForm(openDb, id, form({ group: "Fresh", groupColor: "1" }))).toEqual({
      ok: false,
      message: COLOR_TAKEN_MESSAGE,
    });
    expect(taskOf(id).group).toBe("B");
    expect(groupsNow()).toEqual(before);
  });

  describe("when all 8 group colors are taken", () => {
    /** One task in each of 8 groups, named Group 1 to Group 8. */
    function eight(): string[] {
      return Array.from({ length: 8 }, (_, n) =>
        made({ name: `Task ${n + 1}`, group: `Group ${n + 1}` }),
      );
    }

    // The task is the only one in its group, so moving it frees that color first, and the new group
    // takes it. Nothing is lost and nothing is refused.
    it("lets the last task of a group move to a new group, which takes the color that was freed", () => {
      const ids = eight();
      expect(updateTaskFromForm(openDb, ids[2], form({ group: "Newcomer" })).ok).toBe(true);
      expect(taskOf(ids[2]).group).toBe("Newcomer");
      expect(groupsNow()).toHaveLength(8);
      expect(groupsNow()).toContain("Newcomer:3");
      expect(groupsNow()).not.toContain("Group 3:3");
    });

    it("refuses a task that is not the last of its group, with the sentence about the limit, and changes nothing", () => {
      const ids = eight();
      const second = made({ name: "Second in group one", group: "Group 1" });
      const before = groupsNow();
      expect(updateTaskFromForm(openDb, second, form({ group: "Newcomer" }))).toEqual({
        ok: false,
        message: GROUP_LIMIT_MESSAGE,
      });
      expect(taskOf(second).group).toBe("Group 1");
      expect(taskOf(ids[0]).group).toBe("Group 1");
      expect(groupsNow()).toEqual(before);
    });

    it("lets any task join a group that exists, and leave its group empty", () => {
      const ids = eight();
      expect(updateTaskFromForm(openDb, ids[0], form({ group: "group 5" })).ok).toBe(true);
      expect(taskOf(ids[0]).group).toBe("Group 5");
      expect(groupsNow()).toHaveLength(7);
      expect(updateTaskFromForm(openDb, ids[1], form({ group: "" })).ok).toBe(true);
      expect(groupsNow()).toHaveLength(6);
    });
  });

  it("gives the generic sentence when the write fails, shows no path, and changes nothing", () => {
    const id = made({ group: "Home" });
    db.exec(
      `CREATE TRIGGER fail_update BEFORE UPDATE ON task
       BEGIN SELECT RAISE(ABORT, 'update failed on C:\\private'); END`,
    );
    const result = updateTaskFromForm(openDb, id, form({ name: "Changed", group: "Brand new" }));
    expect(result).toEqual({ ok: false, message: GENERIC_ACTION_ERROR });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(taskOf(id).name).toBe("Made-up report");
    expect(groupsNow()).toEqual(["Home:1"]);
  });

  it("gives the generic sentence when the database cannot be opened", () => {
    const broken = () => {
      throw new Error("unable to open database file C:\\private\\focusqueue.sqlite");
    };
    expect(updateTaskFromForm(broken, MISSING_ID, form())).toEqual({
      ok: false,
      message: GENERIC_ACTION_ERROR,
    });
  });
});

describe("deleteTaskById", () => {
  const MISSING_ID = "00000000-0000-4000-8000-000000000000";
  const made = (overrides: Partial<Parameters<typeof createTask>[1]> = {}) =>
    createTask(db, { ...VALID, ...overrides } as Parameters<typeof createTask>[1]).id;

  it("deletes the task, and the group it was the last in, which frees the color", () => {
    const id = made({ group: "Home" });
    made({ name: "Second", group: "Work" });
    expect(deleteTaskById(openDb, id)).toEqual({ ok: true });
    expect(listTasks(db).map((t) => t.name)).toEqual(["Second"]);
    expect(listGroups(db)).toEqual([{ name: "Work", color: 2 }]);
  });

  it("keeps a group that another task still uses, and a task with no group changes no group", () => {
    const first = made({ group: "Home" });
    made({ name: "Second", group: "Home" });
    const loose = made({ name: "Loose", group: "" });
    expect(deleteTaskById(openDb, first)).toEqual({ ok: true });
    expect(deleteTaskById(openDb, loose)).toEqual({ ok: true });
    expect(listGroups(db)).toEqual([{ name: "Home", color: 1 }]);
    expect(listTasks(db)).toHaveLength(1);
  });

  it("deletes a done task as well", () => {
    const id = made();
    markDoneTask(openDb, id, "2026-10-14T15:00:00.000Z");
    expect(deleteTaskById(openDb, id)).toEqual({ ok: true });
    expect(count()).toBe(0);
  });

  it("says a task that is gone is gone, and that it was already deleted the second time", () => {
    expect(deleteTaskById(openDb, MISSING_ID)).toEqual({
      ok: false,
      message: TASK_GONE_MESSAGE,
      gone: true,
    });
    const id = made();
    expect(deleteTaskById(openDb, id)).toEqual({ ok: true });
    expect(deleteTaskById(openDb, id)).toMatchObject({ ok: false, gone: true });
  });

  it.each([
    ["nothing", undefined],
    ["null", null],
    ["a number", 5],
    ["an object", { id: "x" }],
    ["a list", [MISSING_ID]],
    ["empty text", ""],
    ["text that is not an id", "not-a-task-id"],
    ["SQL", "'; DROP TABLE task; --"],
  ])("refuses %s as the id, without opening the database, and logs nothing of it", (_l, id) => {
    made();
    (openDb as ReturnType<typeof vi.fn>).mockClear();
    expect(deleteTaskById(openDb, id)).toEqual({ ok: false, message: GENERIC_ACTION_ERROR });
    expect(openDb).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0])).toContain("delete a task");
    expect(String(consoleError.mock.calls[0])).not.toContain("DROP");
    expect(count()).toBe(1);
  });

  // The task and its group go together or not at all.
  it("changes nothing when the group cannot be deleted after the task was", () => {
    const id = made({ group: "Home" });
    db.exec(
      `CREATE TRIGGER fail_group_delete BEFORE DELETE ON task_group
       BEGIN SELECT RAISE(ABORT, 'group delete failed on C:\\private'); END`,
    );
    const result = deleteTaskById(openDb, id);
    expect(result).toEqual({ ok: false, message: GENERIC_ACTION_ERROR });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(count()).toBe(1);
    expect(listGroups(db)).toEqual([{ name: "Home", color: 1 }]);
  });

  it("gives the generic sentence when the database cannot be opened", () => {
    const broken = () => {
      throw new Error("unable to open database file C:\\private\\focusqueue.sqlite");
    };
    expect(deleteTaskById(broken, MISSING_ID)).toEqual({
      ok: false,
      message: GENERIC_ACTION_ERROR,
    });
  });
});
