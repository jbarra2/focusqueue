import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildQueue } from "@/lib/sort";
import type { Task } from "@/lib/task";
import { QueueView } from "./queue-view";

const today = "2026-10-14"; // a Wednesday

function task(overrides: Partial<Task>): Task {
  return {
    id: crypto.randomUUID(),
    name: "Task",
    group: "Home",
    description: "",
    dueDate: "2026-10-14",
    difficulty: "med",
    createdAt: "2026-10-10T12:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

function render(tasks: Task[]): string {
  return renderToStaticMarkup(<QueueView queue={buildQueue(tasks, today)} today={today} />);
}

/** The markup of one section, from its heading to the next heading. */
function sectionOf(html: string, headingId: string): string {
  const start = html.indexOf(`id="${headingId}"`);
  const next = html.indexOf("<h2", start + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

describe("QueueView", () => {
  it("puts the first Due soon task on the Do now card", () => {
    const html = render([
      task({ name: "Rest of week", dueDate: "2026-10-16" }),
      task({ name: "Overdue chore", dueDate: "2026-10-12" }),
    ]);
    const focus = sectionOf(html, "focus-heading");
    expect(focus).toContain("Overdue chore");
    expect(focus).not.toContain("Rest of week");
  });

  it("says the week is clear when only Later tasks exist", () => {
    const html = render([task({ name: "Far away", dueDate: "2026-11-30" })]);
    const focus = sectionOf(html, "focus-heading");
    expect(focus).toContain("The week is clear.");
    expect(focus).not.toContain("Far away");
    expect(sectionOf(html, "later-heading")).toContain("Far away");
  });

  it("lists a task done this week under Done, not as overdue", () => {
    const completedAt = new Date(2026, 9, 13, 18, 0).toISOString(); // Tuesday evening, local
    const html = render([
      task({ name: "Finished chore", dueDate: "2026-10-12", completedAt }),
      task({ name: "Open chore", dueDate: "2026-10-16" }),
    ]);
    const done = sectionOf(html, "done-heading");
    expect(done).toContain("Finished chore");
    expect(done).toContain("Done Tue, Oct 13");
    expect(done).not.toContain("Overdue");
    expect(sectionOf(html, "due-soon-heading")).not.toContain("Finished chore");
  });

  it("lists the sections in page order", () => {
    const html = render([]);
    const order = ["Do now", "Due soon", "Rest of this week", "Later", "Done"].map((title) =>
      html.indexOf(`>${title}</h2>`),
    );
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("shows an overdue task as overdue in words", () => {
    expect(render([task({ dueDate: "2026-10-12" })])).toContain("Overdue · Mon, Oct 12");
  });

  it("escapes task text", () => {
    const html = render([
      task({ name: "<script>alert(1)</script>", description: "<img src=x onerror=alert(1)>" }),
    ]);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });
});
