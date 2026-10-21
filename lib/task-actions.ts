import "server-only";
import type { Database } from "better-sqlite3";
import { GENERIC_ACTION_ERROR, toActionError } from "./action-error";
import { localDay } from "./date";
import { taskIdSchema, taskInputSchema, type TaskInput } from "./task-schema";
import { clearOldCompleted, createTask, deleteTask, markDone, markOpen, updateTask } from "./tasks";

// The logic of the write actions, apart from Next, so it can be tested with a database in memory.
// app/actions.ts is the thin Server Action around it. Whatever arrives from the browser is
// untrusted, so each function here picks the fields it knows, checks them with Zod before the
// database is opened, and answers with a result that holds only what the page needs.

export type AddTaskResult = { ok: true; id: string } | { ok: false; message: string };

/**
 * The answer to marking a task done or open. `gone` is set when no task has that id any more, for
 * example because it was deleted in another tab. The page is drawn again for that too, so the card
 * that is still showing it goes.
 */
export type MarkResult = { ok: true } | { ok: false; message: string; gone?: true };

/** The answer to saving an edited task. `gone` is set as for MarkResult. */
export type UpdateTaskResult =
  { ok: true; id: string } | { ok: false; message: string; gone?: true };

/** The answer to deleting a task. It has the shape of MarkResult, `gone` included. */
export type DeleteResult = MarkResult;

export type ClearResult = { ok: true; deleted: number } | { ok: false; message: string };

export const TASK_GONE_MESSAGE = "That task is no longer here, so the page has been refreshed.";

// The fields of the add and edit forms, which readTaskInput reads. Each one is text, so a file
// under any of them, even a second value of a repeated field, can only come from a hand-made
// request. A test checks this list against the task schema's fields, so a field added to one is not
// left out here.
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
 * The answer to a request that is not the add form or the edit form. There is no sentence a person
 * could act on, so it is the generic one, and the server's log gets one line. The line names the
 * kind of request and a field from the list above, never anything that was sent.
 */
function refuseForged(form: "add" | "edit", what: string): AddTaskResult {
  console.error(`Refused a request that is not the ${form} form: ${what}.`);
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

/** The task fields of the add and edit forms. A field that is not listed here, such as an id, is never read. */
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
  if (!(formData instanceof FormData)) return refuseForged("add", "it is not form data");
  const withFile = fieldWithFile(formData);
  if (withFile !== undefined)
    return refuseForged("add", `a file was sent in the ${withFile} field`);
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

/**
 * Does something to one task, by its id: marks it done or open, or deletes it. The id is the only
 * thing that comes from the page, and it must be a UUID: anything else, such as a number or an
 * object, can only come from a hand-made request. That is refused with the generic sentence before
 * the database is opened, and the log gets one fixed line that says nothing about what was sent.
 * `verb` is only for that line. Never throws.
 */
function byId(
  openDb: () => Database,
  id: unknown,
  verb: "mark" | "delete",
  write: (db: Database, taskId: string) => boolean,
): MarkResult {
  const parsed = taskIdSchema.safeParse(id);
  if (!parsed.success) {
    console.error(`Refused a request to ${verb} a task that has no valid task id.`);
    return { ok: false, message: GENERIC_ACTION_ERROR };
  }
  try {
    if (write(openDb(), parsed.data)) return { ok: true };
    return { ok: false, message: TASK_GONE_MESSAGE, gone: true };
  } catch (error) {
    return { ok: false, message: toActionError(error) };
  }
}

/** Marks a task done. A task that is already done keeps its first completion time. */
export function markDoneTask(
  openDb: () => Database,
  id: unknown,
  now: string = new Date().toISOString(),
): MarkResult {
  return byId(openDb, id, "mark", (db, taskId) => markDone(db, taskId, now));
}

/** Marks a task open again. */
export function markOpenTask(openDb: () => Database, id: unknown): MarkResult {
  return byId(openDb, id, "mark", markOpen);
}

/** Deletes one task, and its group when it was the group's last task, which frees the color. */
export function deleteTaskById(openDb: () => Database, id: unknown): DeleteResult {
  return byId(openDb, id, "delete", deleteTask);
}

/**
 * Saves an edited task from the edit form's fields. The checks come in this order, and the
 * database is opened only after the last of them: the id must be a UUID, the input must be form
 * data with no file under a task field, and the fields must pass the schema. A task that is gone
 * answers with the sentence that says so and `gone`, so the page is drawn again without it. Every
 * field is sent and the whole record is written. Never throws: a failure comes back as one sentence.
 */
export function updateTaskFromForm(
  openDb: () => Database,
  id: unknown,
  formData: unknown,
): UpdateTaskResult {
  const parsed = taskIdSchema.safeParse(id);
  if (!parsed.success) {
    console.error("Refused a request to edit a task that has no valid task id.");
    return { ok: false, message: GENERIC_ACTION_ERROR };
  }
  if (!(formData instanceof FormData)) return refuseForged("edit", "it is not form data");
  const withFile = fieldWithFile(formData);
  if (withFile !== undefined)
    return refuseForged("edit", `a file was sent in the ${withFile} field`);
  const input = readTaskInput(formData);
  try {
    // updateTask checks the input again, as every write does. This check comes first so that bad
    // input never reaches the database, not even to open it.
    taskInputSchema.parse(input);
    if (updateTask(openDb(), parsed.data, input)) return { ok: true, id: parsed.data };
    return { ok: false, message: TASK_GONE_MESSAGE, gone: true };
  } catch (error) {
    return { ok: false, message: toActionError(error) };
  }
}

/**
 * Deletes the tasks completed before this week, and the groups that leaves empty. It takes no
 * input from the page, so there is nothing in the request to forge: which day it is comes from the
 * server's own clock, the same one the page reads, in the same local time. Never throws.
 */
export function clearOldCompletedTasks(
  openDb: () => Database,
  now: Date = new Date(),
): ClearResult {
  try {
    return { ok: true, deleted: clearOldCompleted(openDb(), localDay(now.toISOString())) };
  } catch (error) {
    return { ok: false, message: toActionError(error) };
  }
}
