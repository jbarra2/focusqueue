"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { addTask, type AddTaskResult } from "@/lib/task-actions";

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
