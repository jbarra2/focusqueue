import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildQueue, upNext } from "@/lib/sort";
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

function render(tasks: Task[], groups: Group[] = []): string {
  const queue = buildQueue(tasks, today);
  return renderToStaticMarkup(
    <CardStack
      tasks={upNext(queue)}
      groups={groups}
      today={today}
      doNowId={queue.doNow?.id ?? null}
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
    const info = html.slice(html.indexOf("<aside"), html.indexOf("</aside>"));
    expect(info).toContain("Plan trip");
    expect(info).toContain("Home");
    expect(info).toContain("Overdue · Mon, Oct 12");
    expect(info).toContain("High");
    expect(info).toContain("Book the train");
    expect(info).not.toContain("Not shown");
  });

  it("says no group and no description when they are empty", () => {
    const info = render([task({ name: "Bare" })]);
    expect(info).toContain("No group");
    expect(info).toContain("No description");
  });

  it("cuts a long group name on the info card, and keeps the full name as its tooltip", () => {
    const longName = "G".repeat(100);
    const html = render([task({ name: "Wide", group: longName })], [{ name: longName, color: 2 }]);
    const info = html.slice(html.indexOf("<aside"), html.indexOf("</aside>"));
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
    const info = html.slice(html.indexOf("<aside"), html.indexOf("</aside>"));
    expect(info).toContain("&lt;b&gt;not bold&lt;/b&gt; &amp; plain");
    expect(info).not.toContain("<b>");
    expect(info).not.toContain("</b>");
  });

  it("puts the description in its own box, with no tab stop on the card", () => {
    const html = render([task({ description: "Line one\nLine two" })]);
    const info = html.slice(html.indexOf("<aside"), html.indexOf("</aside>"));
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
