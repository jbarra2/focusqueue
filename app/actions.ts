"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import {
  addTask,
  clearOldCompletedTasks,
  markDoneTask,
  markOpenTask,
  type AddTaskResult,
  type ClearResult,
  type MarkResult,
} from "@/lib/task-actions";

// Server Actions are POSTs that anyone who can reach the page can send, so each one only passes its
// arguments on to a function in lib/ that checks them. This file may export async functions only.

export async function addTaskAction(formData: FormData): Promise<AddTaskResult> {
  const result = addTask(getDb, formData);
  if (result.ok) {
    // The task is saved by now. If drawing the page again fails, that must not come back as a
    // failed action, because the form would then say the task was lost and invite a second one.
    // Every view is the same page, so one path covers them all. The page is drawn again in this
    // same response, and a page visited before is fetched again when it is reached with Back.
    try {
      revalidatePath("/");
    } catch (error) {
      console.error("The page could not be refreshed after a task was added:", error);
    }
  }
  return result;
}

// The same rule for the actions below: the write is done by the time the page is drawn again, so a
// failure to draw it is logged and not reported as a failed write.
function refreshPage(after: string): void {
  try {
    revalidatePath("/");
  } catch (error) {
    console.error(`The page could not be refreshed after ${after}:`, error);
  }
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

// Takes nothing from the page. Whatever a request carries is ignored, and the day comes from the
// server's clock.
export async function clearOldCompletedAction(): Promise<ClearResult> {
  const result = clearOldCompletedTasks(getDb);
  if (result.ok) refreshPage("old completed tasks were cleared");
  return result;
}
