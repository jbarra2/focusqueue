import "server-only";
import type { Database } from "better-sqlite3";
import { GENERIC_ACTION_ERROR, toActionError } from "./action-error";
import { taskInputSchema, type TaskInput } from "./task-schema";
import { createTask } from "./tasks";

// The logic of the write actions, apart from Next, so it can be tested with a database in memory.
// app/actions.ts is the thin Server Action around it. Whatever arrives from the browser is
// untrusted, so each function here picks the fields it knows, checks them with Zod before the
// database is opened, and answers with a result that holds only what the page needs.

export type AddTaskResult = { ok: true; id: string } | { ok: false; message: string };

/** The text of a field, or "" when it is missing or is a file, so the schema's sentence applies. */
function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** The group color: nothing when none was sent, a whole number when it looks like one, else NaN. */
function colorOf(formData: FormData): number | undefined {
  const value = formData.get("groupColor");
  if (value === null || value === "") return undefined;
  return typeof value === "string" && /^\d{1,2}$/.test(value) ? Number(value) : NaN;
}

/** The task fields of the add form. A field that is not listed here, such as an id, is never read. */
function readTaskInput(formData: FormData): TaskInput {
  const group = formData.get("group");
  return {
    name: text(formData, "name"),
    group: typeof group === "string" ? group : undefined,
    groupColor: colorOf(formData),
    description: text(formData, "description"),
    dueDate: text(formData, "dueDate"),
    // Not checked here: the schema refuses anything but the three difficulties.
    difficulty: text(formData, "difficulty") as TaskInput["difficulty"],
  };
}

/**
 * Adds a task from the add form's fields. `openDb` is called only after the input is valid.
 * Never throws: a failure comes back as one sentence.
 */
export function addTask(openDb: () => Database, formData: unknown): AddTaskResult {
  // A hand-made request can send anything in place of the form.
  if (!(formData instanceof FormData)) return { ok: false, message: GENERIC_ACTION_ERROR };
  const input = readTaskInput(formData);
  try {
    // createTask checks the input again, as every write does. This check comes first so that bad
    // input never reaches the database, not even to open it.
    taskInputSchema.parse(input);
    const task = createTask(openDb(), input);
    return { ok: true, id: task.id };
  } catch (error) {
    return { ok: false, message: toActionError(error) };
  }
}
