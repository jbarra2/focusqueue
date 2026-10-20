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

// The fields of the add form, which readTaskInput reads. Each one is text, so a file under any of
// them, even a second value of a repeated field, can only come from a hand-made request. A test
// checks this list against the task schema's fields, so a field added to one is not left out here.
const TASK_FIELDS = [
  "name",
  "group",
  "groupColor",
  "description",
  "dueDate",
  "difficulty",
] as const;

/** The first of the task fields that has a file under it, or undefined when all are text. */
function fieldWithFile(formData: FormData): string | undefined {
  return TASK_FIELDS.find((key) => formData.getAll(key).some((value) => typeof value !== "string"));
}

/**
 * The answer to a request that is not the add form. There is no sentence a person could act on,
 * so it is the generic one, and the server's log gets one line. The line names the kind of request
 * and a field from the list above, never anything that was sent.
 */
function refuseForged(what: string): AddTaskResult {
  console.error(`Refused a request that is not the add form: ${what}.`);
  return { ok: false, message: GENERIC_ACTION_ERROR };
}

/** The text of a field, or "" when it is missing, so the schema's sentence applies. */
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
  // A hand-made request can send anything in place of the form, or a file in place of a field.
  if (!(formData instanceof FormData)) return refuseForged("it is not form data");
  const withFile = fieldWithFile(formData);
  if (withFile !== undefined) return refuseForged(`a file was sent in the ${withFile} field`);
  const input = readTaskInput(formData);
  try {
    // createTask checks the input again, as every write does. This check comes first so that bad
    // input never reaches the database, not even to open it, which creates the data folder and
    // the file. The second check is the one that protects every other caller of createTask.
    taskInputSchema.parse(input);
    const task = createTask(openDb(), input);
    return { ok: true, id: task.id };
  } catch (error) {
    return { ok: false, message: toActionError(error) };
  }
}
