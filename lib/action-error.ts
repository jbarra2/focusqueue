import { ZodError } from "zod";
import { GroupError } from "./tasks";

// What a person sees when a write fails. An expected failure has one sentence they can act on.
// Anything else may carry SQL, a file path or a stack, so it is logged on the server and replaced
// by this sentence.
export const GENERIC_ACTION_ERROR =
  "Something went wrong and nothing was saved, so please try again.";

/** The one sentence to show for an error thrown while handling a write. Safe to send to the browser. */
export function toActionError(error: unknown): string {
  // A schema message is written for the person, and the first one is the field to fix first.
  if (error instanceof ZodError) return error.issues[0]?.message ?? GENERIC_ACTION_ERROR;
  // A group sentence is also written for the person (the color limit, a color that is taken).
  if (error instanceof GroupError) return error.message;
  console.error("A write failed:", error);
  return GENERIC_ACTION_ERROR;
}
