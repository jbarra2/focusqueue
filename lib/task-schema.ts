import { z } from "zod";

// Shared by the server, which enforces it, and the browser, which only uses it for messages.

export const taskInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(200, "Keep the name under 200 characters."),
  group: z
    .string()
    .trim()
    .min(1, "Enter a group.")
    .max(100, "Keep the group under 100 characters."),
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
