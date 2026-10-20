import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, stackView, type Filters } from "@/lib/filter";
import { buildQueue } from "@/lib/sort";
import type { Group, Task } from "@/lib/task";
import { CardStack } from "./card-stack";

const today = "2026-10-14"; // a Wednesday

function task(overrides: Partial<Task>): Task {
  return {
    id: crypto.randomUUID(),
    name: "Task",
    group: null,
    description: "",
    dueDate: "2026-10-14",
    difficulty: "med",
    createdAt: "2026-10-10T12:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

// Renders the stack the way the page does: the queue and the filters decide its props.
function render(
  tasks: Task[],
  groups: Group[] = [],
  filters: Filters = DEFAULT_FILTERS,
  focusTaskId: string | null = null,
): string {
  const queue = buildQueue(tasks, today);
  return renderToStaticMarkup(
    <CardStack
      {...stackView(queue, filters)}
      groups={groups}
      today={today}
      focusTaskId={focusTaskId}
    />,
  );
}

function count(html: string, text: string): number {
  return html.split(text).length - 1;
}

/** The markup of the list of cards, without the info card. */
function listOf(html: string): string {
  return html.slice(html.indexOf("<ol"), html.indexOf("</ol>"));
}

/** The markup of the info card, which comes right before the list of cards. */
function infoOf(html: string): string {
  return html.slice(html.indexOf('class="card info-card"'), html.indexOf("<ol"));
}

describe("CardStack", () => {
  it("shows each task once, in Up next order", () => {
    const html = render([
      task({ name: "Later job", dueDate: "2026-10-26" }),
      task({ name: "Friday job", dueDate: "2026-10-16" }),
      task({ name: "Overdue job", dueDate: "2026-10-12" }),
    ]);
    const list = listOf(html);
    const order = ["Overdue job", "Friday job", "Later job"].map((name) => list.indexOf(name));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const name of ["Overdue job", "Friday job", "Later job"]) {
      // As visible text. A stacked card also has its name as a tooltip, which is not a second card.
      expect(count(list, `>${name}<`)).toBe(1);
    }
  });

  it("opens on the Do now task, with one Do now label", () => {
    const html = render([
      task({ name: "Friday job", dueDate: "2026-10-16" }),
      task({ name: "Overdue job", dueDate: "2026-10-12" }),
    ]);
    expect(count(html, ">Do now<")).toBe(1);
    const nameCard = html.slice(html.indexOf('class="card name-card"'), html.indexOf("</article>"));
    expect(nameCard).toContain("Overdue job");
    expect(nameCard).toContain(">Do now<");
    expect(html).toContain("1 of 2");
  });

  it("shows one info card before the list, with the details of the focus card", () => {
    const html = render(
      [
        task({
          name: "Plan trip",
          group: "Home",
          dueDate: "2026-10-12",
          difficulty: "high",
          description: "Book the train",
        }),
        task({ name: "Other", dueDate: "2026-10-16", description: "Not shown" }),
      ],
      [{ name: "Home", color: 3 }],
    );
    expect(count(html, "info-card")).toBe(1);
    expect(html.indexOf("info-card")).toBeLessThan(html.indexOf("<ol"));
    const info = infoOf(html);
    expect(info).toContain("Plan trip");
    expect(info).toContain("Home");
    expect(info).toContain("Overdue · Mon, Oct 12");
    expect(info).toContain("High");
    expect(info).toContain("Book the train");
    expect(info).not.toContain("Not shown");
  });

  it("makes the info card a group named Details, and not a landmark of its own", () => {
    // A complementary landmark (an aside) inside main is flagged by axe, and a group is not.
    const html = render([task({ name: "Plan trip" })]);
    expect(html).not.toContain("<aside");
    expect(html).not.toContain("</aside>");
    const card = html.slice(
      html.indexOf('<div class="card info-card"'),
      html.indexOf(">", html.indexOf('class="card info-card"')),
    );
    expect(card).toContain('role="group"');
    expect(card).toContain('aria-labelledby="info-title"');
    expect(html).toContain('<h2 id="info-title">Details</h2>');
  });

  it("says no group and no description when they are empty", () => {
    const info = render([task({ name: "Bare" })]);
    expect(info).toContain("No group");
    expect(info).toContain("No description");
  });

  it("cuts a long group name on the info card, and keeps the full name as its tooltip", () => {
    const longName = "G".repeat(100);
    const html = render([task({ name: "Wide", group: longName })], [{ name: longName, color: 2 }]);
    const info = infoOf(html);
    expect(info).toContain(`class="info-group" title="${longName}"`);
    // A task with no group has nothing to show as a tooltip.
    const bare = render([task({ name: "Bare" })]);
    expect(bare).toContain('class="info-group">No group');
  });

  it("colors cards by group slot and leaves a task with no group on the base colors", () => {
    const html = render(
      [
        task({ name: "Homey", group: "home", dueDate: "2026-10-12" }),
        task({ name: "Loose", dueDate: "2026-10-16" }),
        task({ name: "Errand", group: "Errands", dueDate: "2026-10-17" }),
      ],
      [
        { name: "Home", color: 3 },
        { name: "Errands", color: 8 },
      ],
    );
    // The name card and the info card follow the focus task, and Errands has a stacked card.
    expect(count(html, 'data-slot="3"')).toBe(2);
    expect(count(html, 'data-slot="8"')).toBe(1);
    expect(count(html, "data-slot=")).toBe(3);
  });

  it("ignores a group slot outside 1 to 8 and a group that is not in the list", () => {
    const html = render(
      [
        task({ name: "A", group: "Odd" }),
        task({ name: "B", group: "Ghost", dueDate: "2026-10-16" }),
      ],
      [{ name: "Odd", color: 9 }],
    );
    expect(html).not.toContain("data-slot");
  });

  it("shows the group name, so color is not the only cue", () => {
    const html = render(
      [
        task({ name: "A", dueDate: "2026-10-12" }),
        task({ name: "B", group: "Home", dueDate: "2026-10-16" }),
      ],
      [{ name: "Home", color: 2 }],
    );
    expect(listOf(html)).toContain("Home");
  });

  it("spells out overdue in words", () => {
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

  it("shows HTML-looking text exactly as written, never as markup", () => {
    // A person can type this into a description. It is plain text, so the tags show up as
    // characters and nothing is made bold.
    const html = render([task({ description: "<b>not bold</b> & plain" })]);
    const info = infoOf(html);
    expect(info).toContain("&lt;b&gt;not bold&lt;/b&gt; &amp; plain");
    expect(info).not.toContain("<b>");
    expect(info).not.toContain("</b>");
  });

  it("puts the description in its own box, with no tab stop on the card", () => {
    const html = render([task({ description: "Line one\nLine two" })]);
    const info = infoOf(html);
    expect(count(info, 'class="info-description task-description"')).toBe(1);
    expect(info).toContain("Line one\nLine two");
    // The box is a tab stop only when its text overflows, which only a browser can tell.
    expect(info).not.toContain("tabindex");
    // The labelled box, which names the box when it does scroll, is in the markup.
    expect(info).toContain('id="info-description-label"');
  });

  it("says there are no open tasks and shows no stack when nothing is open", () => {
    const html = render([]);
    expect(html).toContain("No open tasks.");
    expect(html).not.toContain("The week is clear.");
    expect(html).not.toContain('class="stack"');
    expect(html).not.toContain("Previous");
  });

  it("says the week is clear but still shows Later tasks, with no Do now label", () => {
    const html = render([task({ name: "Far away", dueDate: "2026-11-30" })]);
    expect(html).toContain("The week is clear.");
    expect(html).toContain("Far away");
    expect(html).not.toContain(">Do now<");
    expect(html).toContain("1 of 1");
  });

  it("has Previous and Next buttons and a visible position, with Previous inactive at the start", () => {
    const html = render([task({ name: "A" }), task({ name: "B", dueDate: "2026-10-16" })]);
    expect(html).toMatch(/<button type="button" aria-disabled="true">Previous<\/button>/);
    expect(html).toMatch(/<button type="button">Next<\/button>/);
    expect(html).toContain("1 of 2");
  });

  it("keeps the end buttons focusable, so focus is not lost: aria-disabled, never disabled", () => {
    const html = render([task({ name: "Only" })]);
    expect(html).toMatch(/aria-disabled="true">Next<\/button>/);
    expect(html).not.toContain('disabled=""');
  });

  it("keeps the two empty messages apart: no tasks at all, and nothing due before Later", () => {
    expect(render([])).toContain('<p class="empty">No open tasks.</p>');
    const laterOnly = render([task({ name: "Far", dueDate: "2026-11-30" })]);
    expect(laterOnly).toContain('<p class="empty">The week is clear.</p>');
    expect(laterOnly).not.toContain("No open tasks.");
    // A week with something due says neither.
    const busy = render([task({ name: "Today" })]);
    expect(busy).not.toContain("The week is clear.");
    expect(busy).not.toContain("No open tasks.");
  });

  it("labels the list with the number of tasks", () => {
    expect(render([task({ name: "A" })])).toContain('aria-label="Up next, 1 task"');
    // The role is explicit because Safari drops it from a list with no bullets.
    expect(render([task({ name: "A" })])).toContain('role="list"');
    expect(render([task({ name: "A" }), task({ name: "B" })])).toContain(
      'aria-label="Up next, 2 tasks"',
    );
  });

  it("hides cards far from the focus card", () => {
    const tasks = Array.from({ length: 10 }, (_, n) =>
      task({ name: `Job ${n}`, dueDate: "2026-10-14", createdAt: `2026-10-10T12:00:0${n}.000Z` }),
    );
    const html = render(tasks);
    // Positions 0 to 6 are within reach of the focus card at position 0. 7 to 9 are not.
    expect(count(html, "data-far")).toBe(3);
  });

  it("makes every stacked card a button with a visible name", () => {
    const html = render([task({ name: "A" }), task({ name: "B", dueDate: "2026-10-16" })]);
    expect(html).toMatch(/<button type="button" class="card stacked-card"[^>]*>.*B.*<\/button>/);
  });
});

function localNoon(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 12).toISOString();
}

describe("CardStack in the other views", () => {
  const completedView: Filters = { ...DEFAULT_FILTERS, view: "completed" };
  const finished = task({
    name: "Finished job",
    dueDate: "2026-10-12",
    completedAt: localNoon("2026-10-13"),
  });
  const finishedEarlier = task({
    name: "Earlier job",
    dueDate: "2026-10-11",
    completedAt: localNoon("2026-10-12"),
  });

  it("names the view in the label of the list", () => {
    const open = task({ name: "Soon", dueDate: "2026-10-15" });
    expect(render([open], [], { ...DEFAULT_FILTERS, view: "due-soon" })).toContain(
      'aria-label="Due soon, 1 task"',
    );
    expect(render([finished, finishedEarlier], [], completedView)).toContain(
      'aria-label="Completed, 2 tasks"',
    );
  });

  it("says what is missing when a view has no tasks, and shows no stack", () => {
    const html = render([task({ name: "Far", dueDate: "2026-11-30" })], [], completedView);
    expect(html).toContain('<p class="empty">No tasks completed this week.</p>');
    expect(html).not.toContain('class="stack"');
    const filtered = render([task({ name: "Plan" })], [], { ...DEFAULT_FILTERS, q: "zzz" });
    expect(filtered).toContain('<p class="empty">No tasks match these filters.</p>');
  });

  it("shows done tasks most recent first, each once", () => {
    const list = listOf(render([finishedEarlier, finished], [], completedView));
    expect(list.indexOf("Finished job")).toBeGreaterThanOrEqual(0);
    expect(list.indexOf("Finished job")).toBeLessThan(list.indexOf("Earlier job"));
    expect(count(list, ">Finished job<")).toBe(1);
  });

  it("does not call a done task overdue, though its due date has passed", () => {
    const html = render([finished], [], completedView);
    expect(html).not.toContain("Overdue");
    expect(html).not.toContain('class="overdue"');
    // The due date is still shown, as a plain date.
    expect(html).toContain("Mon, Oct 12");
  });

  it("shows when a done task was completed, and never for an open task", () => {
    expect(infoOf(render([finished], [], completedView))).toMatch(
      /<dt>Completed<\/dt><dd>Tue, Oct 13<\/dd>/,
    );
    expect(render([task({ name: "Open job" })])).not.toContain(">Completed<");
  });

  it("marks no done card as Do now", () => {
    const html = render([task({ name: "Due today" }), finished], [], completedView);
    expect(html).not.toContain(">Do now<");
    expect(html).toContain("1 of 1");
  });

  it("an open task past its due date still says Overdue on its stacked card", () => {
    // The earlier one is the focus card, so the later one is the stacked card in the list.
    const html = render([
      task({ name: "Late job", dueDate: "2026-10-10" }),
      task({ name: "Later job", dueDate: "2026-10-11" }),
    ]);
    expect(listOf(html)).toContain('class="overdue"');
    expect(listOf(html)).toContain("Overdue · Sun, Oct 11");
  });
});

describe("CardStack, where it starts", () => {
  const first = task({ name: "First job", dueDate: "2026-10-12" });
  const second = task({ name: "Second job", dueDate: "2026-10-16" });
  const third = task({ name: "Third job", dueDate: "2026-10-17" });

  function nameCard(html: string): string {
    return html.slice(html.indexOf('class="card name-card"'), html.indexOf("</article>"));
  }

  it("starts on the task a link asks for", () => {
    const html = render([first, second, third], [], DEFAULT_FILTERS, third.id);
    expect(nameCard(html)).toContain("Third job");
    expect(html).toContain("3 of 3");
    // It is not Do now, so it has no Do now label, and the Do now task has one on its card.
    expect(nameCard(html)).not.toContain(">Do now<");
    expect(html).toContain(">Do now<");
  });

  it("starts on the Do now task when no task is asked for", () => {
    const html = render([second, first, third]);
    expect(nameCard(html)).toContain("First job");
    expect(nameCard(html)).toContain(">Do now<");
  });

  it("starts on the Do now task when the task asked for is not in the list", () => {
    const html = render([first, second], [], DEFAULT_FILTERS, crypto.randomUUID());
    expect(nameCard(html)).toContain("First job");
  });

  it("starts on the first card when neither is in the list", () => {
    // Filtered to Later, where the Do now task is not, and the asked task is open but elsewhere.
    const later = task({ name: "Later job", dueDate: "2026-11-30" });
    const html = render([first, later], [], { ...DEFAULT_FILTERS, view: "later" }, first.id);
    expect(nameCard(html)).toContain("Later job");
    expect(html).toContain("1 of 1");
  });

  it("starts on the first card of Completed even when an open task is asked for", () => {
    const done = task({ name: "Done job", completedAt: localNoon("2026-10-13") });
    const html = render([first, done], [], { ...DEFAULT_FILTERS, view: "completed" }, first.id);
    expect(nameCard(html)).toContain("Done job");
  });
});
