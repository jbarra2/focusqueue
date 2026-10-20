import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "better-sqlite3";
import { GENERIC_ACTION_ERROR } from "@/lib/action-error";
import { listTasks } from "@/lib/tasks";
import { addTaskAction } from "./actions";

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
