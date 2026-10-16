import { z } from "zod";
import { GROUP_COLOR_COUNT } from "./theme";

// Shared by the server, which enforces it, and the browser, which only uses it for messages.

// The two group sentences are the only group errors a person can act on. The server shows them as is.
export const GROUP_LIMIT_MESSAGE = `All ${GROUP_COLOR_COUNT} group colors are taken, so leave the group empty, choose an existing group, or delete an old group's tasks to free its color.`;
export const COLOR_TAKEN_MESSAGE = "Another group already uses that color, so choose a free one.";

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a group name.")
  .max(100, "Keep the group under 100 characters.");

export const groupColorSchema = z
  .int("Choose one of the group colors.")
  .min(1, "Choose one of the group colors.")
  .max(GROUP_COLOR_COUNT, "Choose one of the group colors.");

export const taskInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(200, "Keep the name under 200 characters."),
  // A group is optional. Empty text means no group.
  group: z
    .string()
    .trim()
    .max(100, "Keep the group under 100 characters.")
    .nullish()
    .transform((value) => (value === undefined || value === null || value === "" ? null : value)),
  // Used only when the group is new. Without it, the first free color is used.
  groupColor: groupColorSchema.optional(),
  description: z
    .string()
    .trim()
    .max(2000, "Keep the description under 2000 characters.")
    .default(""),
  dueDate: z.iso.date("Enter a due date."),
  difficulty: z.enum(["low", "med", "high"], "Choose a difficulty."),
});

export type TaskInput = z.input<typeof taskInputSchema>;

export const taskIdSchema = z.uuid();
