import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "better-sqlite3";
import { GENERIC_ACTION_ERROR } from "@/lib/action-error";
import { createTask, listGroups, listTasks, markDone } from "@/lib/tasks";
import { addTaskAction, clearOldCompletedAction, markDoneAction, markOpenAction } from "./actions";

// The Server Action around addTask: what it asks Next to do after a write. Next's cache call and
// the database are stand-ins (a database in memory with made-up data), so nothing real is touched.

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db")>()),
  getDb: mocks.getDb,
}));

let db: Database;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  const { openDatabase } = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  db = openDatabase(":memory:");
  mocks.getDb.mockReset().mockReturnValue(db);
  mocks.revalidatePath.mockReset();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

function form(fields: Record<string, string> = {}): FormData {
  const data = new FormData();
  const all = { name: "Made-up report", dueDate: "2026-10-23", difficulty: "med", ...fields };
  for (const [key, value] of Object.entries(all)) data.set(key, value);
  return data;
}

describe("addTaskAction", () => {
  it("adds the task, asks Next to draw the page again once, and gives back the id", async () => {
    const result = await addTaskAction(form());
    expect(result).toEqual({ ok: true, id: listTasks(db)[0].id });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });

  it("does not ask Next to draw the page again when the task is refused", async () => {
    const result = await addTaskAction(form({ name: "" }));
    expect(result).toEqual({ ok: false, message: "Enter a name." });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(listTasks(db)).toEqual([]);
  });

  // The write is done, so a failure of the refresh must not read as a failed write: the form
  // would say the task was lost, and the person would add it a second time.
  it("still says the task was added when the refresh fails, and logs it", async () => {
    mocks.revalidatePath.mockImplementation(() => {
      throw new Error("refresh failed");
    });
    const result = await addTaskAction(form());
    expect(result.ok).toBe(true);
    expect(listTasks(db)).toHaveLength(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("gives the generic sentence when the database cannot be opened, and refreshes nothing", async () => {
    mocks.getDb.mockImplementation(() => {
      throw new Error("unable to open database file C:\\private\\focusqueue.sqlite");
    });
    const result = await addTaskAction(form());
    expect(result).toEqual({ ok: false, message: GENERIC_ACTION_ERROR });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses anything that is not a form, because a hand-made request can send it", async () => {
    const result = await addTaskAction({ name: "Made-up" } as unknown as FormData);
    expect(result).toEqual({ ok: false, message: GENERIC_ACTION_ERROR });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("markDoneAction and markOpenAction", () => {
  const MISSING_ID = "00000000-0000-4000-8000-000000000000";
  const made = () =>
    createTask(db, { name: "Made-up report", dueDate: "2026-10-23", difficulty: "med" }).id;

  it("marks the task and asks Next to draw the page again once", async () => {
    const id = made();
    expect(await markDoneAction(id)).toEqual({ ok: true });
    expect(listTasks(db)[0].completedAt).not.toBeNull();
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");

    mocks.revalidatePath.mockClear();
    expect(await markOpenAction(id)).toEqual({ ok: true });
    expect(listTasks(db)[0].completedAt).toBeNull();
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
  });

  // The card that is still showing a task that is gone has to go, so the page is drawn again for
  // that answer too, and the answer says why.
  it.each([markDoneAction, markOpenAction])(
    "draws the page again for a task that is gone, and says so",
    async (action) => {
      const result = await action(MISSING_ID);
      expect(result).toMatchObject({ ok: false, gone: true });
      expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
    },
  );

  it.each([markDoneAction, markOpenAction])(
    "refuses an id that is not one, with the generic sentence, and touches nothing",
    async (action) => {
      const result = await action({ id: MISSING_ID } as unknown as string);
      expect(result).toEqual({ ok: false, message: GENERIC_ACTION_ERROR });
      expect(mocks.getDb).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it.each([markDoneAction, markOpenAction])(
    "gives the generic sentence when the database cannot be opened, and refreshes nothing",
    async (action) => {
      mocks.getDb.mockImplementation(() => {
        throw new Error("unable to open database file C:\\private\\focusqueue.sqlite");
      });
      expect(await action(MISSING_ID)).toEqual({ ok: false, message: GENERIC_ACTION_ERROR });
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  // The write is done, so a failure of the refresh must not read as a failed write.
  it.each([markDoneAction, markOpenAction])(
    "still says it worked when the refresh fails, and logs it",
    async (action) => {
      mocks.revalidatePath.mockImplementation(() => {
        throw new Error("refresh failed");
      });
      const result = await action(made());
      expect(result).toEqual({ ok: true });
      expect(consoleError).toHaveBeenCalledTimes(1);
    },
  );
});

describe("clearOldCompletedAction", () => {
  const at = (d: number, month = 9) => new Date(2026, month, d, 12).toISOString();

  // Wednesday the 14th, so the week began on Monday the 12th.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 14, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function done(name: string, completedAt: string, group: string | null = null): void {
    const { id } = createTask(db, { name, group, dueDate: "2026-10-23", difficulty: "med" });
    markDone(db, id, completedAt);
  }

  it("clears the old tasks and their groups, and asks Next to draw the page again once", async () => {
    done("old", at(8), "Gone");
    done("this week", at(13), "Kept");
    expect(await clearOldCompletedAction()).toEqual({ ok: true, deleted: 1 });
    expect(listTasks(db).map((t) => t.name)).toEqual(["this week"]);
    expect(listGroups(db).map((g) => g.name)).toEqual(["Kept"]);
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });

  // It reads nothing from the request. A hand-made call can pass a day or a list of ids, and they
  // change nothing: the day is the server's, and the tasks are the ones the rule picks.
  it("ignores whatever the request carries", async () => {
    done("old", at(8));
    done("this week", at(13));
    const forged = clearOldCompletedAction as (...args: unknown[]) => Promise<unknown>;
    expect(await forged("2099-12-31", { today: "2099-12-31", ids: ["x"] })).toEqual({
      ok: true,
      deleted: 1,
    });
    expect(listTasks(db).map((t) => t.name)).toEqual(["this week"]);
  });

  it("gives the generic sentence when the database cannot be opened, and refreshes nothing", async () => {
    mocks.getDb.mockImplementation(() => {
      throw new Error("unable to open database file C:\\private\\focusqueue.sqlite");
    });
    expect(await clearOldCompletedAction()).toEqual({ ok: false, message: GENERIC_ACTION_ERROR });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("still says it worked when the refresh fails, and logs it", async () => {
    mocks.revalidatePath.mockImplementation(() => {
      throw new Error("refresh failed");
    });
    done("old", at(8));
    expect(await clearOldCompletedAction()).toEqual({ ok: true, deleted: 1 });
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("refreshes even when there was nothing to clear, so the page shows what is true", async () => {
    expect(await clearOldCompletedAction()).toEqual({ ok: true, deleted: 0 });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
  });
});
