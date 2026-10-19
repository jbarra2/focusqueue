import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "better-sqlite3";
import { openDatabase } from "./db";
import {
  createTask,
  deleteTask,
  GroupError,
  listGroups,
  listTasks,
  markDone,
  markOpen,
  setGroupColor,
  updateTask,
} from "./tasks";
import { COLOR_TAKEN_MESSAGE, GROUP_LIMIT_MESSAGE, type TaskInput } from "./task-schema";

const INPUT: TaskInput = {
  name: "Made-up report",
  group: "Made-up group",
  description: "Chapters 1 and 2",
  dueDate: "2026-10-16",
  difficulty: "med",
};

const NOW = "2026-10-14T15:00:00.000Z";
const MISSING_ID = "00000000-0000-4000-8000-000000000000";

let db: Database;

beforeEach(() => {
  db = openDatabase(":memory:");
});

function count(): number {
  return (db.prepare("SELECT count(*) AS n FROM task").get() as { n: number }).n;
}

describe("createTask and listTasks", () => {
  it("round-trips a task", () => {
    const task = createTask(db, INPUT, NOW);
    expect(task.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(listTasks(db)).toEqual([
      {
        id: task.id,
        name: INPUT.name,
        group: INPUT.group,
        description: INPUT.description,
        dueDate: INPUT.dueDate,
        difficulty: INPUT.difficulty,
        createdAt: NOW,
        completedAt: null,
      },
    ]);
  });

  it("trims text and defaults the description to empty", () => {
    const task = createTask(db, { ...INPUT, name: "  Letter  ", description: undefined }, NOW);
    expect(task.name).toBe("Letter");
    expect(listTasks(db)[0].description).toBe("");
  });

  it("keeps a name that has a visible character next to invisible ones", () => {
    const task = createTask(db, { ...INPUT, name: "​Report​", group: "   " }, NOW);
    // Only trim() runs on the text. The invisible characters stay, and one visible character is enough.
    expect(task.name).toBe("​Report​");
    // White space alone is an empty group, which means no group. It is not an error.
    expect(task.group).toBeNull();
  });

  it("stores text that looks like SQL as plain text", () => {
    const name = `Robert'); DROP TABLE task; --`;
    createTask(db, { ...INPUT, name }, NOW);
    expect(listTasks(db).map((t) => t.name)).toEqual([name]);
  });

  it.each([
    ["an empty name", { name: "" }],
    ["a name of only zero-width spaces", { name: "​​" }],
    ["a name of only white space and a zero-width joiner", { name: "  ‍ " }],
    ["a name of only control characters", { name: "\u0007\u0000" }],
    ["a group of only zero-width spaces", { group: "​" }],
    ["a group that is too long", { group: "x".repeat(101) }],
    ["a color outside the slots", { group: "New", groupColor: 9 }],
    ["a color that is not a whole number", { group: "New", groupColor: 1.5 }],
    ["a bad difficulty", { difficulty: "hard" }],
    ["a date that does not exist", { dueDate: "2026-02-30" }],
    ["a date without padding", { dueDate: "2026-2-3" }],
    ["a name that is too long", { name: "x".repeat(201) }],
  ])("rejects %s and writes nothing", (_label, overrides) => {
    expect(() => createTask(db, { ...INPUT, ...overrides } as TaskInput, NOW)).toThrow();
    expect(count()).toBe(0);
  });
});

describe("updateTask", () => {
  it("replaces the fields and keeps id, created, and completed", () => {
    const task = createTask(db, INPUT, NOW);
    markDone(db, task.id, NOW);
    const changed = {
      ...INPUT,
      name: "Renamed",
      dueDate: "2026-10-20",
      difficulty: "high" as const,
    };
    expect(updateTask(db, task.id, changed)).toBe(true);
    expect(listTasks(db)[0]).toMatchObject({
      id: task.id,
      name: "Renamed",
      dueDate: "2026-10-20",
      difficulty: "high",
      createdAt: NOW,
      completedAt: NOW,
    });
  });

  it("leaves the task as it was when the input is invalid", () => {
    const task = createTask(db, INPUT, NOW);
    expect(() => updateTask(db, task.id, { ...INPUT, name: "" })).toThrow();
    expect(listTasks(db)[0].name).toBe(INPUT.name);
  });

  it("refuses a name with no visible character and leaves the task as it was", () => {
    const task = createTask(db, INPUT, NOW);
    expect(() => updateTask(db, task.id, { ...INPUT, name: "​" })).toThrow();
    expect(() => updateTask(db, task.id, { ...INPUT, group: "​" })).toThrow();
    expect(listTasks(db)[0]).toMatchObject({ name: INPUT.name, group: INPUT.group });
  });

  it("returns false for a missing or malformed id", () => {
    createTask(db, INPUT, NOW);
    expect(updateTask(db, MISSING_ID, INPUT)).toBe(false);
    expect(updateTask(db, "' OR 1=1 --", INPUT)).toBe(false);
  });
});

describe("deleteTask", () => {
  it("deletes only the given task", () => {
    const keep = createTask(db, INPUT, NOW);
    const gone = createTask(db, { ...INPUT, name: "Other" }, NOW);
    expect(deleteTask(db, gone.id)).toBe(true);
    expect(listTasks(db).map((t) => t.id)).toEqual([keep.id]);
  });

  it("returns false for a missing or malformed id", () => {
    createTask(db, INPUT, NOW);
    expect(deleteTask(db, MISSING_ID)).toBe(false);
    expect(deleteTask(db, "' OR 1=1 --")).toBe(false);
    expect(count()).toBe(1);
  });
});

describe("markDone and markOpen", () => {
  it("sets and clears completed_at", () => {
    const task = createTask(db, INPUT, NOW);
    expect(markDone(db, task.id, NOW)).toBe(true);
    expect(listTasks(db)[0].completedAt).toBe(NOW);
    expect(markOpen(db, task.id)).toBe(true);
    expect(listTasks(db)[0].completedAt).toBeNull();
  });

  it("keeps the first completion time when marked done twice", () => {
    const task = createTask(db, INPUT, NOW);
    markDone(db, task.id, NOW);
    markDone(db, task.id, "2026-10-15T09:00:00.000Z");
    expect(listTasks(db)[0].completedAt).toBe(NOW);
  });

  it("returns false for a missing id", () => {
    expect(markDone(db, MISSING_ID, NOW)).toBe(false);
    expect(markOpen(db, MISSING_ID)).toBe(false);
  });
});

describe("listGroups", () => {
  it("lists each group once with its color, sorted without regard to case", () => {
    createTask(db, { ...INPUT, group: "garden" }, NOW);
    createTask(db, { ...INPUT, group: "Errands" }, NOW);
    createTask(db, { ...INPUT, group: "garden" }, NOW);
    expect(listGroups(db)).toEqual([
      { name: "Errands", color: 2 },
      { name: "garden", color: 1 },
    ]);
  });

  it("treats names that differ only in case as one group", () => {
    createTask(db, { ...INPUT, group: "Garden" }, NOW);
    createTask(db, { ...INPUT, group: "GARDEN" }, NOW);
    expect(listGroups(db)).toEqual([{ name: "Garden", color: 1 }]);
    expect(listTasks(db).map((t) => t.group)).toEqual(["Garden", "Garden"]);
  });
});

/** Adds one task in each of `count` groups named Group 1, Group 2, and so on. */
function fillGroups(count: number): string[] {
  const ids: string[] = [];
  for (let n = 1; n <= count; n += 1) {
    ids.push(createTask(db, { ...INPUT, group: `Group ${n}` }, NOW).id);
  }
  return ids;
}

function colorOf(name: string): number | undefined {
  return listGroups(db).find((g) => g.name === name)?.color;
}

describe("groups on create", () => {
  it.each([
    ["empty text", { group: "" }],
    ["blank text", { group: "  \t " }],
    ["null", { group: null }],
    ["a missing group", { group: undefined }],
  ])("lets a task have no group with %s and adds no group", (_label, overrides) => {
    const task = createTask(db, { ...INPUT, ...overrides }, NOW);
    expect(task.group).toBeNull();
    expect(listTasks(db)[0].group).toBeNull();
    expect(listGroups(db)).toEqual([]);
  });

  it("gives new groups the first free color in order", () => {
    fillGroups(3);
    expect(listGroups(db).map((g) => g.color)).toEqual([1, 2, 3]);
  });

  it("uses the requested color for a new group, then the first free one", () => {
    createTask(db, { ...INPUT, group: "Pick", groupColor: 5 }, NOW);
    createTask(db, { ...INPUT, group: "Next" }, NOW);
    expect(colorOf("Pick")).toBe(5);
    expect(colorOf("Next")).toBe(1);
  });

  it("refuses a requested color that is taken and writes nothing", () => {
    createTask(db, { ...INPUT, group: "First", groupColor: 4 }, NOW);
    const attempt = () => createTask(db, { ...INPUT, group: "Second", groupColor: 4 }, NOW);
    expect(attempt).toThrow(new GroupError(COLOR_TAKEN_MESSAGE));
    expect(count()).toBe(1);
    expect(listGroups(db)).toEqual([{ name: "First", color: 4 }]);
  });

  it("ignores the requested color for a group that already exists", () => {
    createTask(db, { ...INPUT, group: "Home", groupColor: 2 }, NOW);
    createTask(db, { ...INPUT, group: "home", groupColor: 7 }, NOW);
    expect(listGroups(db)).toEqual([{ name: "Home", color: 2 }]);
  });

  it("refuses a ninth group with one sentence and writes nothing", () => {
    fillGroups(8);
    const attempt = () => createTask(db, { ...INPUT, group: "Group 9" }, NOW);
    expect(attempt).toThrow(GroupError);
    expect(attempt).toThrow(GROUP_LIMIT_MESSAGE);
    expect(count()).toBe(8);
    expect(listGroups(db)).toHaveLength(8);
  });

  it("still takes tasks with no group or an existing group when all colors are taken", () => {
    fillGroups(8);
    createTask(db, { ...INPUT, group: "" }, NOW);
    createTask(db, { ...INPUT, group: "group 3" }, NOW);
    expect(count()).toBe(10);
    expect(listGroups(db)).toHaveLength(8);
  });

  it("leaves nothing behind when the task insert fails after the group was added", () => {
    db.exec(
      `CREATE TRIGGER fail_task_insert BEFORE INSERT ON task
       BEGIN SELECT RAISE(ABORT, 'insert failed'); END`,
    );
    expect(() => createTask(db, { ...INPUT, group: "Doomed" }, NOW)).toThrow();
    expect(listGroups(db)).toEqual([]);
    expect(count()).toBe(0);
  });
});

describe("groups on update", () => {
  it("keeps the group, and its color, when the task stays in it", () => {
    const task = createTask(db, { ...INPUT, group: "Home" }, NOW);
    expect(updateTask(db, task.id, { ...INPUT, group: "HOME", name: "Renamed" })).toBe(true);
    expect(listGroups(db)).toEqual([{ name: "Home", color: 1 }]);
    expect(listTasks(db)[0]).toMatchObject({ name: "Renamed", group: "Home" });
  });

  it("keeps the old group when another task still uses it", () => {
    const a = createTask(db, { ...INPUT, group: "A" }, NOW);
    createTask(db, { ...INPUT, group: "A" }, NOW);
    updateTask(db, a.id, { ...INPUT, group: "B" });
    expect(listGroups(db).map((g) => g.name)).toEqual(["A", "B"]);
  });

  it("deletes the old group when its last task moves, which frees the color", () => {
    const a = createTask(db, { ...INPUT, group: "A" }, NOW);
    updateTask(db, a.id, { ...INPUT, group: "B" });
    // A's color was freed first, so the new group B takes it.
    expect(listGroups(db)).toEqual([{ name: "B", color: 1 }]);
    createTask(db, { ...INPUT, group: "C" }, NOW);
    expect(colorOf("C")).toBe(2);
  });

  it("clearing the group makes the task ungrouped and deletes a group left empty", () => {
    const a = createTask(db, { ...INPUT, group: "A" }, NOW);
    expect(updateTask(db, a.id, { ...INPUT, group: "" })).toBe(true);
    expect(listTasks(db)[0].group).toBeNull();
    expect(listGroups(db)).toEqual([]);
  });

  it("gives a task a group when it had none", () => {
    const task = createTask(db, { ...INPUT, group: "" }, NOW);
    updateTask(db, task.id, { ...INPUT, group: "New", groupColor: 3 });
    expect(listTasks(db)[0].group).toBe("New");
    expect(colorOf("New")).toBe(3);
  });

  it("lets the last task of a group move to a new group when all colors are taken", () => {
    const ids = fillGroups(8);
    expect(updateTask(db, ids[7], { ...INPUT, group: "Replacement" })).toBe(true);
    expect(listGroups(db)).toHaveLength(8);
    expect(colorOf("Replacement")).toBe(8);
    expect(colorOf("Group 8")).toBeUndefined();
  });

  it("refuses a ninth group when the old group still has tasks, and changes nothing", () => {
    const ids = fillGroups(8);
    createTask(db, { ...INPUT, group: "Group 1" }, NOW);
    const before = listTasks(db);
    expect(() => updateTask(db, ids[0], { ...INPUT, group: "Group 9" })).toThrow(
      GROUP_LIMIT_MESSAGE,
    );
    expect(listTasks(db)).toEqual(before);
    expect(listGroups(db)).toHaveLength(8);
  });

  it("refuses a taken color for a new group and keeps the old group", () => {
    const a = createTask(db, { ...INPUT, group: "A" }, NOW);
    createTask(db, { ...INPUT, group: "Taker", groupColor: 6 }, NOW);
    expect(() => updateTask(db, a.id, { ...INPUT, group: "B", groupColor: 6 })).toThrow(
      COLOR_TAKEN_MESSAGE,
    );
    expect(listTasks(db).find((t) => t.id === a.id)?.group).toBe("A");
    expect(listGroups(db).map((g) => g.name)).toEqual(["A", "Taker"]);
  });

  it("adds no group for a task that does not exist", () => {
    createTask(db, INPUT, NOW);
    expect(updateTask(db, MISSING_ID, { ...INPUT, group: "Ghost" })).toBe(false);
    expect(listGroups(db).map((g) => g.name)).toEqual(["Made-up group"]);
  });
});

describe("groups on delete and done", () => {
  it("deletes a group with its last task and frees the color for the next new group", () => {
    const ids = fillGroups(8);
    expect(deleteTask(db, ids[2])).toBe(true);
    expect(listGroups(db)).toHaveLength(7);
    createTask(db, { ...INPUT, group: "Newcomer" }, NOW);
    expect(colorOf("Newcomer")).toBe(3);
  });

  it("keeps a group while another task uses it", () => {
    const a = createTask(db, { ...INPUT, group: "A" }, NOW);
    createTask(db, { ...INPUT, group: "A" }, NOW);
    deleteTask(db, a.id);
    expect(listGroups(db)).toEqual([{ name: "A", color: 1 }]);
  });

  it("deleting an ungrouped task leaves the groups alone", () => {
    createTask(db, { ...INPUT, group: "A" }, NOW);
    const loose = createTask(db, { ...INPUT, group: "" }, NOW);
    deleteTask(db, loose.id);
    expect(listGroups(db)).toHaveLength(1);
  });

  it("keeps the group of a done task, and of one marked open again", () => {
    const task = createTask(db, { ...INPUT, group: "A" }, NOW);
    markDone(db, task.id, NOW);
    expect(listGroups(db)).toEqual([{ name: "A", color: 1 }]);
    markOpen(db, task.id);
    expect(listTasks(db)[0].group).toBe("A");
  });
});

describe("setGroupColor", () => {
  it("changes the color of a group, matching the name without case", () => {
    createTask(db, { ...INPUT, group: "Home" }, NOW);
    expect(setGroupColor(db, "HOME", 6)).toBe(true);
    expect(listGroups(db)).toEqual([{ name: "Home", color: 6 }]);
  });

  it("accepts the color the group already has", () => {
    createTask(db, { ...INPUT, group: "Home" }, NOW);
    expect(setGroupColor(db, "Home", 1)).toBe(true);
  });

  it("refuses a color another group uses and changes nothing", () => {
    createTask(db, { ...INPUT, group: "A" }, NOW);
    createTask(db, { ...INPUT, group: "B" }, NOW);
    expect(() => setGroupColor(db, "B", 1)).toThrow(new GroupError(COLOR_TAKEN_MESSAGE));
    expect(listGroups(db)).toEqual([
      { name: "A", color: 1 },
      { name: "B", color: 2 },
    ]);
  });

  it("returns false for a group that does not exist or a malformed name", () => {
    createTask(db, { ...INPUT, group: "A" }, NOW);
    expect(setGroupColor(db, "Nowhere", 3)).toBe(false);
    expect(setGroupColor(db, "   ", 3)).toBe(false);
    expect(setGroupColor(db, "' OR 1=1 --", 3)).toBe(false);
  });

  it.each([0, 9, 1.5, Number.NaN])("rejects color %s", (color) => {
    createTask(db, { ...INPUT, group: "A" }, NOW);
    expect(() => setGroupColor(db, "A", color)).toThrow();
    expect(listGroups(db)).toEqual([{ name: "A", color: 1 }]);
  });
});
