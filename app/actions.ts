"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import {
  addTask,
  clearOldCompletedTasks,
  deleteTaskById,
  markDoneTask,
  markOpenTask,
  updateTaskFromForm,
  type AddTaskResult,
  type ClearResult,
  type DeleteResult,
  type MarkResult,
  type UpdateTaskResult,
} from "@/lib/task-actions";

// Server Actions are POSTs that anyone who can reach the page can send, so each one only passes its
// arguments on to a function in lib/ that checks them. This file may export async functions only.

// The write is done by the time the page is drawn again. If drawing it fails, that must not come
// back as a failed action, because the form would then say the task was lost and invite a second
// one, so the failure is logged and not reported. Every view is the same page, so one path covers
// them all. The page is drawn again in the same response, and a page visited before is fetched
// again when it is reached with Back.
function refreshPage(after: string): void {
  try {
    revalidatePath("/");
  } catch (error) {
    console.error(`The page could not be refreshed after ${after}:`, error);
  }
}

export async function addTaskAction(formData: FormData): Promise<AddTaskResult> {
  const result = addTask(getDb, formData);
  if (result.ok) refreshPage("a task was added");
  return result;
}

export async function markDoneAction(id: string): Promise<MarkResult> {
  const result = markDoneTask(getDb, id);
  // A task that is gone is drawn again too, so the card that is still showing it goes.
  if (result.ok || result.gone) refreshPage("a task was marked done");
  return result;
}

export async function markOpenAction(id: string): Promise<MarkResult> {
  const result = markOpenTask(getDb, id);
  if (result.ok || result.gone) refreshPage("a task was marked open");
  return result;
}

export async function updateTaskAction(id: string, formData: FormData): Promise<UpdateTaskResult> {
  const result = updateTaskFromForm(getDb, id, formData);
  // A task that is gone is drawn again too, so the card that is still showing it goes.
  if (result.ok || result.gone) refreshPage("a task was edited");
  return result;
}

export async function deleteTaskAction(id: string): Promise<DeleteResult> {
  const result = deleteTaskById(getDb, id);
  if (result.ok || result.gone) refreshPage("a task was deleted");
  return result;
}

// Takes nothing from the page. Whatever a request carries is ignored, and the day comes from the
// server's clock.
export async function clearOldCompletedAction(): Promise<ClearResult> {
  const result = clearOldCompletedTasks(getDb);
  if (result.ok) refreshPage("old completed tasks were cleared");
  return result;
}
