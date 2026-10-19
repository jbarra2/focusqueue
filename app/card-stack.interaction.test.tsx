// @vitest-environment happy-dom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Group, Task } from "@/lib/task";
import { CardStack } from "./card-stack";

// These tests run the component in a simulated page, so effects, key and wheel listeners, and
// focus all work. The markup-only tests are in card-stack.test.tsx.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const today = "2026-10-14";

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    name: `Task ${id}`,
    group: null,
    description: "",
    dueDate: "2026-10-14",
    difficulty: "med",
    createdAt: "2026-10-10T12:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

const A = task("a");
const B = task("b");
const C = task("c");

let container: HTMLDivElement;
let root: Root;
let clock: number;

function show(
  tasks: Task[],
  groups: Group[] = [],
  extra: Partial<ComponentProps<typeof CardStack>> = {},
) {
  act(() => {
    root.render(
      <CardStack
        tasks={tasks}
        groups={groups}
        today={today}
        doNowId={tasks[0]?.id ?? null}
        label="Up next"
        emptyMessage="No open tasks."
        {...extra}
      />,
    );
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  clock = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function status(): string {
  // The position only. The announced text also carries the task name, for screen readers.
  return (container.querySelector(".stack-status")?.textContent ?? "").split(":")[0];
}

function focusCardName(): string {
  return container.querySelector(".name-card h2")?.textContent ?? "";
}

function infoCardName(): string {
  return container.querySelector(".info-card .task-name")?.textContent ?? "";
}

function stacked(name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll<HTMLButtonElement>("button.stacked-card")].find(
    (button) => button.textContent?.includes(name),
  );
  if (!found) throw new Error(`No stacked card for ${name}.`);
  return found;
}

function control(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll<HTMLButtonElement>(".stack-controls button")].find(
    (button) => button.textContent === label,
  );
  if (!found) throw new Error(`No ${label} button.`);
  return found;
}

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function wheel(init: WheelEventInit, target?: Element) {
  const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init });
  // happy-dom's wheel events drop the modifier keys that a browser sets, so set them here.
  for (const key of ["ctrlKey", "metaKey"] as const) {
    if (init[key]) Object.defineProperty(event, key, { value: true });
  }
  act(() => {
    (target ?? container.querySelector(".stack")!).dispatchEvent(event);
  });
  return event;
}

function click(element: Element) {
  act(() => {
    (element as HTMLElement).click();
  });
}

describe("the stack in a page", () => {
  it("opens on the first task, with the info card and the focus card matching", () => {
    show([A, B, C]);
    expect(status()).toBe("1 of 3");
    expect(focusCardName()).toBe("Task a");
    expect(infoCardName()).toBe("Task a");
  });

  it("announces the task name with the position, so a move by button says where it landed", () => {
    show([A, B, C]);
    const status = container.querySelector(".stack-status")!;
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("1 of 3: Task a");
    click(control("Next"));
    expect(status.textContent).toBe("2 of 3: Task b");
    // The name is for screen readers. What is drawn is only the position.
    expect(status.querySelector(".visually-hidden")?.textContent).toBe(": Task b");
  });

  describe("buttons", () => {
    it("Next and Previous move the focus, and the info card follows it", () => {
      show([A, B, C]);
      click(control("Next"));
      expect(status()).toBe("2 of 3");
      expect(focusCardName()).toBe("Task b");
      expect(infoCardName()).toBe("Task b");
      click(control("Previous"));
      expect(focusCardName()).toBe("Task a");
    });

    it("stay focusable at the ends, so focus is not lost", () => {
      show([A, B]);
      const next = control("Next");
      next.focus();
      click(next);
      click(next);
      expect(status()).toBe("2 of 2");
      expect(next.getAttribute("aria-disabled")).toBe("true");
      expect(document.activeElement).toBe(next);
    });
  });

  describe("keyboard focus on a stacked card", () => {
    it("moves to the focus card when a key moves the stack, so it is not left on a card that slides away", () => {
      show(Array.from({ length: 12 }, (_, n) => task(`t${n}`)));
      for (let step = 0; step < 4; step += 1) press("ArrowRight");
      expect(focusCardName()).toBe("Task t4");
      const nearest = stacked("Task t3");
      nearest.focus();
      expect(document.activeElement).toBe(nearest);
      press("ArrowRight", {}, nearest);
      expect(focusCardName()).toBe("Task t5");
      expect(document.activeElement).toBe(container.querySelector(".name-card"));
    });

    it("keeps focus on the Previous and Next buttons while the stack moves", () => {
      show([A, B, C]);
      const next = control("Next");
      next.focus();
      press("ArrowRight", {}, next);
      expect(focusCardName()).toBe("Task b");
      expect(document.activeElement).toBe(next);
    });
  });

  describe("clicking a stacked card", () => {
    it("makes it the focus card and moves keyboard focus onto it", () => {
      show([A, B, C]);
      click(stacked("Task c"));
      expect(status()).toBe("3 of 3");
      expect(focusCardName()).toBe("Task c");
      expect(infoCardName()).toBe("Task c");
      expect(document.activeElement).toBe(container.querySelector(".name-card"));
    });

    it("goes back by clicking a past card", () => {
      show([A, B, C]);
      click(control("Next"));
      click(control("Next"));
      click(stacked("Task a"));
      expect(focusCardName()).toBe("Task a");
    });
  });

  describe("keys", () => {
    it("move with the arrow keys, and Home and End go to the ends", () => {
      show([A, B, C]);
      expect(press("ArrowRight").defaultPrevented).toBe(true);
      expect(focusCardName()).toBe("Task b");
      press("ArrowLeft");
      expect(focusCardName()).toBe("Task a");
      press("ArrowRight", {}, container.querySelector("button.stacked-card")!);
      press("End", {}, container.querySelector("button.stacked-card")!);
      expect(focusCardName()).toBe("Task c");
      press("Home", {}, container.querySelector("button.stacked-card")!);
      expect(focusCardName()).toBe("Task a");
    });

    it("leave Home and End to the page when nothing in the stack has focus", () => {
      show([A, B, C]);
      click(control("Next"));
      expect(press("End").defaultPrevented).toBe(false);
      expect(press("Home").defaultPrevented).toBe(false);
      expect(focusCardName()).toBe("Task b");
    });

    it("do nothing in a text field", () => {
      show([A, B, C]);
      const field = document.createElement("input");
      document.body.append(field);
      field.focus();
      expect(press("ArrowRight", {}, field).defaultPrevented).toBe(false);
      expect(focusCardName()).toBe("Task a");
    });

    it("do nothing from another control on the page", () => {
      show([A, B, C]);
      const other = document.createElement("button");
      document.body.append(other);
      other.focus();
      press("ArrowRight", {}, other);
      expect(focusCardName()).toBe("Task a");
    });

    it("ignore other keys and key combinations", () => {
      show([A, B, C]);
      press("ArrowDown");
      press("a");
      press("ArrowRight", { ctrlKey: true });
      press("ArrowRight", { altKey: true });
      press("ArrowRight", { metaKey: true });
      expect(focusCardName()).toBe("Task a");
    });

    it("leave Home and End to a focused description that scrolls", () => {
      show([A, task("long", { description: "line\n".repeat(50) }), C]);
      click(control("Next"));
      const box = container.querySelector<HTMLElement>(".info-description")!;
      Object.defineProperty(box, "scrollHeight", { configurable: true, value: 400 });
      Object.defineProperty(box, "clientHeight", { configurable: true, value: 100 });
      expect(press("End", {}, box).defaultPrevented).toBe(false);
      expect(focusCardName()).toBe("Task long");
    });

    it("still move to the ends from the focus card when it does not scroll", () => {
      show([A, B, C]);
      click(control("Next"));
      const card = container.querySelector(".name-card")!;
      expect(press("End", {}, card).defaultPrevented).toBe(true);
      expect(focusCardName()).toBe("Task c");
      press("Home", {}, container.querySelector(".name-card")!);
      expect(focusCardName()).toBe("Task a");
    });

    it("leave Home and End to a focus card that scrolls a very long name", () => {
      show([A, B, C]);
      const card = container.querySelector(".name-card")!;
      Object.defineProperty(card, "scrollHeight", { configurable: true, value: 400 });
      Object.defineProperty(card, "clientHeight", { configurable: true, value: 100 });
      expect(press("End", {}, card).defaultPrevented).toBe(false);
      expect(focusCardName()).toBe("Task a");
    });

    it("ignore a key that does not come from an element, without an error", () => {
      show([A, B, C]);
      expect(() => press("ArrowRight", {}, document)).not.toThrow();
      expect(focusCardName()).toBe("Task a");
    });
  });

  describe("the wheel", () => {
    it("counts one notch in lines as a full step, as Firefox reports it", () => {
      show([A, B, C]);
      wheel({ deltaY: 3, deltaMode: 1 });
      expect(focusCardName()).toBe("Task b");
    });

    it("counts a notch in pages as a full step", () => {
      show([A, B, C]);
      wheel({ deltaX: 1, deltaMode: 2 });
      expect(focusCardName()).toBe("Task b");
    });

    it("picks the axis once, from the raw movement, in lines too", () => {
      // Mostly vertical, with a little sideways. The page scrolls, so the browser keeps it.
      // Counting every axis with any movement as a full step would have taken the sideways part.
      show([A, B, C]);
      vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(5000);
      const event = wheel({ deltaX: 1, deltaY: 3, deltaMode: 1 });
      expect(event.defaultPrevented).toBe(false);
      expect(focusCardName()).toBe("Task a");
    });

    it("moves the way the stronger axis points when the page does not scroll, in lines", () => {
      show([A, B, C]);
      wheel({ deltaX: -1, deltaY: 3, deltaMode: 1 });
      expect(focusCardName()).toBe("Task b");
    });

    it("moves one card for a sideways scroll, and keeps the page from also scrolling", () => {
      show([A, B, C]);
      const event = wheel({ deltaX: 100 });
      expect(focusCardName()).toBe("Task b");
      expect(event.defaultPrevented).toBe(true);
    });

    it("builds up small scrolls before it moves", () => {
      show([A, B, C]);
      wheel({ deltaX: 30 });
      expect(focusCardName()).toBe("Task a");
      wheel({ deltaX: 40 });
      expect(focusCardName()).toBe("Task b");
    });

    it("moves back for a scroll the other way", () => {
      show([A, B, C]);
      wheel({ deltaX: 100 });
      clock += 500;
      wheel({ deltaX: -100 });
      expect(focusCardName()).toBe("Task a");
    });

    it("ignores more scrolling for a moment after a step, so one flick moves one card", () => {
      show([A, B, C]);
      wheel({ deltaX: 100 });
      clock += 50;
      wheel({ deltaX: 100 });
      expect(focusCardName()).toBe("Task b");
      clock += 200;
      wheel({ deltaX: 100 });
      expect(focusCardName()).toBe("Task c");
    });

    it("uses a vertical scroll when the page itself does not scroll", () => {
      show([A, B, C]);
      expect(wheel({ deltaY: 100 }).defaultPrevented).toBe(true);
      expect(focusCardName()).toBe("Task b");
    });

    it("leaves a vertical scroll to the page when the page scrolls", () => {
      show([A, B, C]);
      vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(5000);
      const event = wheel({ deltaY: 100 });
      expect(event.defaultPrevented).toBe(false);
      expect(focusCardName()).toBe("Task a");
    });

    it("leaves browser zoom alone", () => {
      show([A, B, C]);
      const event = wheel({ deltaY: 100, ctrlKey: true });
      expect(event.defaultPrevented).toBe(false);
      expect(focusCardName()).toBe("Task a");
    });

    it("leaves the event to the browser at either end of the stack", () => {
      show([A, B]);
      expect(wheel({ deltaX: -100 }).defaultPrevented).toBe(false);
      wheel({ deltaX: 100 });
      clock += 500;
      expect(wheel({ deltaX: 100 }).defaultPrevented).toBe(false);
      expect(focusCardName()).toBe("Task b");
    });

    it("leaves a vertical scroll to a description that scrolls", () => {
      show([task("long", { description: "line\n".repeat(50) }), B]);
      const box = container.querySelector<HTMLElement>(".info-description")!;
      Object.defineProperty(box, "scrollHeight", { configurable: true, value: 400 });
      Object.defineProperty(box, "clientHeight", { configurable: true, value: 100 });
      const event = wheel({ deltaY: 100 }, box);
      expect(event.defaultPrevented).toBe(false);
      expect(focusCardName()).toBe("Task long");
    });
  });

  describe("when the list changes", () => {
    it("keeps the focus on the same task when a task appears before it", () => {
      show([A, B, C]);
      click(stacked("Task b"));
      show([task("new"), A, B, C]);
      expect(focusCardName()).toBe("Task b");
      expect(status()).toBe("3 of 4");
    });

    it("gives the focus to the card that takes the place of a task that is gone", () => {
      show([A, B, C]);
      click(stacked("Task b"));
      show([A, C]);
      expect(focusCardName()).toBe("Task c");
      expect(status()).toBe("2 of 2");
    });

    it("moves to the last card when the last task is gone", () => {
      show([A, B, C]);
      click(stacked("Task c"));
      show([A, B]);
      expect(focusCardName()).toBe("Task b");
    });

    it("does not take the focus back if the task that was gone returns", () => {
      show([A, B, C]);
      click(stacked("Task b"));
      show([A, C]);
      show([A, B, C]);
      expect(focusCardName()).toBe("Task c");
      expect(status()).toBe("3 of 3");
    });

    it("does not steal keyboard focus from a control outside the stack", () => {
      show([A, B, C]);
      click(stacked("Task c"));
      const filter = document.createElement("input");
      document.body.append(filter);
      filter.focus();
      show([task("new"), A, B, C]);
      expect(document.activeElement).toBe(filter);
    });

    it("keeps working through a refresh in the middle of a wheel scroll", () => {
      show([A, B, C]);
      wheel({ deltaX: 40 });
      show([A, B, C]);
      wheel({ deltaX: 30 });
      expect(focusCardName()).toBe("Task b");
    });

    it("does not steal keyboard focus from a field outside the stack when the wheel moves it", () => {
      show([A, B, C]);
      const filter = document.createElement("input");
      document.body.append(filter);
      filter.focus();
      wheel({ deltaX: 100 });
      expect(focusCardName()).toBe("Task b");
      expect(document.activeElement).toBe(filter);
    });

    it("puts keyboard focus on the new focus card when a move leaves it on the page body", () => {
      show([A, B, C]);
      expect(document.activeElement).toBe(document.body);
      press("ArrowRight");
      expect(document.activeElement).toBe(container.querySelector(".name-card"));
    });

    it("attaches the key and wheel listeners when tasks appear on a page that was empty", () => {
      show([]);
      expect(container.textContent).toContain("No open tasks.");
      show([A, B]);
      press("ArrowRight");
      expect(focusCardName()).toBe("Task b");
      clock += 500;
      wheel({ deltaX: -100 });
      expect(focusCardName()).toBe("Task a");
    });

    it("attaches them again when the list goes empty and then comes back", () => {
      show([A, B]);
      show([]);
      show([A, B]);
      // The stack element is a new one, so the wheel listener has to be on it, not the old one.
      wheel({ deltaX: 100 });
      expect(focusCardName()).toBe("Task b");
      clock += 500;
      press("ArrowLeft");
      expect(focusCardName()).toBe("Task a");
    });
  });

  describe("Tab stops and hidden cards", () => {
    const five = () => ["a", "b", "c", "d", "e"].map((id) => task(id));
    const tabIndexOf = (name: string) => stacked(name).getAttribute("tabindex");

    it("makes only the nearest card on each side a Tab stop", () => {
      show(five());
      // The focus is on the first card, so there is nothing behind it.
      expect(tabIndexOf("Task b")).toBeNull();
      expect(tabIndexOf("Task c")).toBe("-1");
      expect(tabIndexOf("Task d")).toBe("-1");
      expect(tabIndexOf("Task e")).toBe("-1");
    });

    it("moves the Tab stops with the focus", () => {
      show(five());
      press("ArrowRight");
      press("ArrowRight");
      expect(focusCardName()).toBe("Task c");
      expect(tabIndexOf("Task a")).toBe("-1");
      expect(tabIndexOf("Task b")).toBeNull();
      expect(tabIndexOf("Task d")).toBeNull();
      expect(tabIndexOf("Task e")).toBe("-1");
    });

    it("leaves a few Tab stops in the whole stack, not one for every card", () => {
      show(Array.from({ length: 9 }, (_, n) => task(`t${n}`)));
      // Home and End are left to the page when nothing in the stack has focus, so use the arrows.
      for (let step = 0; step < 4; step += 1) press("ArrowRight");
      expect(focusCardName()).toBe("Task t4");
      const stops = [...container.querySelectorAll("button, [tabindex]")].filter(
        (element) => element.getAttribute("tabindex") !== "-1",
      );
      // The nearest card on each side, and Previous and Next.
      expect(stops).toHaveLength(4);
    });

    it("still reaches a card that is not a Tab stop by clicking it", () => {
      show(five());
      click(stacked("Task e"));
      expect(focusCardName()).toBe("Task e");
    });

    it("hides cards that are too far from the focus card", () => {
      show(Array.from({ length: 9 }, (_, n) => task(`t${n}`)));
      const far = (name: string) => stacked(name).closest("li")!.hasAttribute("data-far");
      expect(far("Task t6")).toBe(false);
      expect(far("Task t7")).toBe(true);
    });
  });

  describe("the description box", () => {
    function overflow(box: HTMLElement, overflowing: boolean) {
      Object.defineProperty(box, "scrollHeight", {
        configurable: true,
        value: overflowing ? 400 : 50,
      });
      Object.defineProperty(box, "clientHeight", { configurable: true, value: 100 });
    }

    it("is not a tab stop when the text fits", () => {
      show([task("a", { description: "Short" })]);
      const box = container.querySelector(".info-description")!;
      expect(box.hasAttribute("tabindex")).toBe(false);
      expect(box.hasAttribute("role")).toBe(false);
    });

    it("becomes a labelled tab stop when the text overflows, and stops when it fits again", () => {
      show([task("a", { description: "Short" })]);
      const box = container.querySelector<HTMLElement>(".info-description")!;

      overflow(box, true);
      show([task("a", { description: "A much longer description" })]);
      expect(box.getAttribute("tabindex")).toBe("0");
      expect(box.getAttribute("role")).toBe("region");
      expect(box.getAttribute("aria-labelledby")).toBe("info-description-label");

      overflow(box, false);
      show([task("a", { description: "Short again" })]);
      expect(box.hasAttribute("tabindex")).toBe(false);
      expect(box.hasAttribute("role")).toBe(false);
    });

    it("makes the focus card a tab stop only while a very long name scrolls in it", () => {
      show([task("a", { name: "Short" })]);
      const card = container.querySelector<HTMLElement>(".name-card")!;
      expect(card.getAttribute("tabindex")).toBe("-1");

      overflow(card, true);
      show([task("a", { name: "A name that is much longer than the card can show" })]);
      expect(card.getAttribute("tabindex")).toBe("0");

      overflow(card, false);
      show([task("a", { name: "Short again" })]);
      expect(card.getAttribute("tabindex")).toBe("-1");
    });

    it("is measured again for the next task when the focus moves", () => {
      show([task("a", { description: "Short" }), task("b", { description: "Long" })]);
      const box = container.querySelector<HTMLElement>(".info-description")!;
      overflow(box, true);
      click(control("Next"));
      expect(box.getAttribute("tabindex")).toBe("0");
    });
  });

  describe("where it starts, and what the page says around it", () => {
    it("starts on the task a link asks for", () => {
      show([A, B, C], [], { focusTaskId: "c" });
      expect(status()).toBe("3 of 3");
      expect(focusCardName()).toBe("Task c");
      expect(infoCardName()).toBe("Task c");
    });

    it("starts on the Do now task when the task asked for is not in the list", () => {
      show([A, B, C], [], { focusTaskId: "gone", doNowId: "b" });
      expect(focusCardName()).toBe("Task b");
    });

    it("starts on the first card when neither the asked task nor Do now is in the list", () => {
      show([A, B, C], [], { focusTaskId: "gone", doNowId: null });
      expect(focusCardName()).toBe("Task a");
    });

    it("keeps its place when the page sends the same list again with another task asked for", () => {
      // Only a new key restarts the stack, which the page sets from the URL.
      show([A, B, C]);
      press("ArrowRight");
      show([A, B, C], [], { focusTaskId: "c" });
      expect(focusCardName()).toBe("Task b");
    });

    it("says the message it is given when the list is empty", () => {
      show([], [], { emptyMessage: "Nothing is due soon." });
      expect(container.querySelector(".empty")?.textContent).toBe("Nothing is due soon.");
      expect(container.querySelector(".stack")).toBeNull();
    });

    it("puts the notice above the stack, and shows none when it is not given", () => {
      show([A, B], [], { notice: "The week is clear." });
      expect(container.querySelector(".stack > .empty")?.textContent).toBe("The week is clear.");
      show([A, B]);
      expect(container.querySelector(".stack > .empty")).toBeNull();
    });

    it("labels the list with the name of the view", () => {
      show([A, B], [], { label: "Completed" });
      expect(container.querySelector(".track")?.getAttribute("aria-label")).toBe(
        "Completed, 2 tasks",
      );
    });
  });

  describe("controls in the header", () => {
    // The filters sit in the header, outside the stack, so a key pressed there is theirs.
    it("leaves the arrow keys to a menu and a search box", () => {
      show([A, B, C]);
      const menu = document.createElement("select");
      const search = document.createElement("input");
      document.body.append(menu, search);
      for (const field of [menu, search]) {
        const event = press("ArrowRight", {}, field);
        expect(event.defaultPrevented).toBe(false);
        expect(focusCardName()).toBe("Task a");
      }
    });

    // A click on a view link leaves focus on the link. The left and right arrows do nothing on a
    // link, so they still move the stack from there.
    it("moves the stack with the left and right arrows from a link outside it", () => {
      show([A, B, C]);
      const link = document.createElement("a");
      link.href = "/";
      document.body.append(link);
      const next = press("ArrowRight", {}, link);
      expect(next.defaultPrevented).toBe(true);
      expect(focusCardName()).toBe("Task b");
      press("ArrowLeft", {}, link);
      expect(focusCardName()).toBe("Task a");
    });

    it("leaves Home and End to the page from a link outside the stack", () => {
      show([A, B, C]);
      press("ArrowRight");
      const link = document.createElement("a");
      link.href = "/";
      document.body.append(link);
      for (const key of ["Home", "End"]) {
        const event = press(key, {}, link);
        expect(event.defaultPrevented).toBe(false);
      }
      expect(focusCardName()).toBe("Task b");
    });

    it("leaves the arrow keys to a button outside the stack", () => {
      show([A, B, C]);
      const button = document.createElement("button");
      document.body.append(button);
      const event = press("ArrowRight", {}, button);
      expect(event.defaultPrevented).toBe(false);
      expect(focusCardName()).toBe("Task a");
    });
  });
});
