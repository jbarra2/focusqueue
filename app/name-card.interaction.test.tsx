// @vitest-environment happy-dom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_ACTION_ERROR } from "@/lib/action-error";
import type { Task } from "@/lib/task";
import { TASK_GONE_MESSAGE, type MarkResult } from "@/lib/task-actions";
import { CardStack } from "./card-stack";

// These tests run the stack with the buttons on its focus card in a simulated page. The Server
// Actions are stand-ins that a test answers, so nothing here reaches a database. Task text is made
// up. A redraw of the page, which is what Next does after a write, is a second call to show().

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const markDoneAction = vi.hoisted(() => vi.fn());
const markOpenAction = vi.hoisted(() => vi.fn());

vi.mock("./actions", () => ({ markDoneAction, markOpenAction }));

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

const finished = (id: string) => task(id, { completedAt: "2026-10-13T12:00:00.000Z" });

const A = task("a");
const B = task("b");
const C = task("c");

let container: HTMLDivElement;
let root: Root;
let consoleError: ReturnType<typeof vi.spyOn>;

function stack(tasks: Task[]) {
  return (
    <CardStack
      tasks={tasks}
      groups={[]}
      today={today}
      doNowId={tasks[0]?.id ?? null}
      label="Up next"
      emptyMessage="No open tasks."
    />
  );
}

function show(tasks: Task[]) {
  act(() => root.render(stack(tasks)));
}

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  markDoneAction.mockReset();
  markOpenAction.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  // React reports misuse, such as an update outside act, with console.error.
  const reported = consoleError.mock.calls.map((call) => String(call[0]));
  consoleError.mockRestore();
  expect(reported).toEqual([]);
});

function labels(): string[] {
  return [...container.querySelectorAll(".name-card .card-actions button")].map(
    (button) => button.textContent ?? "",
  );
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll<HTMLButtonElement>(".name-card button")].find(
    (el) => el.textContent === label,
  );
  if (!found) throw new Error(`No ${label} button.`);
  return found;
}

function click(element: Element) {
  act(() => (element as HTMLElement).click());
}

function clickAndWait(element: Element): Promise<void> {
  return act(async () => (element as HTMLElement).click());
}

function press(key: string, target: EventTarget = document.body) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function focusCardName(): string {
  return container.querySelector(".name-card h2")?.textContent ?? "";
}

function status(): string {
  return (container.querySelector(".stack-status")?.textContent ?? "").split(":")[0];
}

const messageArea = () => container.querySelector(".stack-message");
const focusCard = () => container.querySelector(".name-card");

/** An answer for a stand-in action that a test gives when it chooses to. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("the button on the focus card", () => {
  it("is Mark done for an open task, and Mark open for a done one", () => {
    show([A]);
    expect(labels()).toEqual(["Mark done"]);
    show([finished("d")]);
    expect(labels()).toEqual(["Mark open"]);
  });

  it("does not take the keyboard focus by being drawn", () => {
    show([A, B]);
    expect(document.activeElement).toBe(document.body);
  });

  it("does not take the keyboard focus by being drawn in StrictMode either", () => {
    act(() =>
      root.render(
        <StrictMode>
          <CardStack
            tasks={[A, B]}
            groups={[]}
            today={today}
            doNowId="a"
            label="Up next"
            emptyMessage="No open tasks."
          />
        </StrictMode>,
      ),
    );
    expect(document.activeElement).toBe(document.body);
    click(button("Mark done"));
    expect(document.activeElement).toBe(button("Yes, done"));
  });

  it("is a button of the focus card, which keeps its heading, and not of a stacked card", () => {
    show([A, B]);
    expect(container.querySelectorAll(".name-card h2")).toHaveLength(1);
    expect(container.querySelectorAll("button.stacked-card .card-actions")).toHaveLength(0);
    expect(container.querySelectorAll(".card-actions")).toHaveLength(1);
  });
});

describe("asking before a task is marked done", () => {
  it("asks first, with the answers in the card, and sends nothing yet", () => {
    show([A]);
    click(button("Mark done"));
    expect(container.querySelector(".card-question p")!.textContent).toBe("Mark done?");
    expect(labels()).toEqual(["Yes, done", "Not yet"]);
    expect(markDoneAction).not.toHaveBeenCalled();
  });

  it("names the question for a screen reader, and puts the focus on the first answer", () => {
    show([A]);
    click(button("Mark done"));
    const group = container.querySelector(".card-question")!;
    expect(group.getAttribute("role")).toBe("group");
    expect(group.getAttribute("aria-labelledby")).toBe(group.querySelector("p")!.id);
    expect(document.activeElement).toBe(button("Yes, done"));
  });

  it("closes on Not yet, gives the focus back to Mark done, and sends nothing", () => {
    show([A]);
    click(button("Mark done"));
    click(button("Not yet"));
    expect(labels()).toEqual(["Mark done"]);
    expect(document.activeElement).toBe(button("Mark done"));
    expect(markDoneAction).not.toHaveBeenCalled();
  });

  it("closes on Escape in the same way", () => {
    show([A]);
    click(button("Mark done"));
    const event = press("Escape", button("Yes, done"));
    expect(event.defaultPrevented).toBe(true);
    expect(labels()).toEqual(["Mark done"]);
    expect(document.activeElement).toBe(button("Mark done"));
  });

  it("is not left open on a card that was moved away from", () => {
    show([A, B]);
    click(button("Mark done"));
    expect(labels()).toEqual(["Yes, done", "Not yet"]);
    press("ArrowRight");
    expect(focusCardName()).toBe("Task b");
    expect(labels()).toEqual(["Mark done"]);
    press("ArrowLeft");
    expect(focusCardName()).toBe("Task a");
    expect(labels()).toEqual(["Mark done"]);
  });
});

// Holding Enter on Mark done repeats the key, and the repeats arrive at Yes, done once it has the
// focus. A repeat is the same press and must not answer the question.
describe("a held key", () => {
  const enter = (init: KeyboardEventInit) =>
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...init });

  it("does not answer the question when its repeats arrive at Yes, done", () => {
    show([A]);
    click(button("Mark done"));
    const repeat = enter({ repeat: true });
    act(() => {
      button("Yes, done").dispatchEvent(repeat);
    });
    // Prevented, which is what stops the browser from pressing the button for it.
    expect(repeat.defaultPrevented).toBe(true);
    expect(markDoneAction).not.toHaveBeenCalled();
  });

  it("leaves a separate press alone, so the answer can still be given from the keyboard", () => {
    show([A]);
    click(button("Mark done"));
    const press = enter({ repeat: false });
    act(() => {
      button("Yes, done").dispatchEvent(press);
    });
    expect(press.defaultPrevented).toBe(false);
  });
});

describe("sending", () => {
  it("sends the id of the task on Yes, done, once", async () => {
    markDoneAction.mockResolvedValue({ ok: true });
    show([A, B]);
    click(button("Mark done"));
    await clickAndWait(button("Yes, done"));
    expect(markDoneAction).toHaveBeenCalledTimes(1);
    expect(markDoneAction).toHaveBeenCalledWith("a");
    expect(markOpenAction).not.toHaveBeenCalled();
  });

  it("sends the id of the task that has the focus, not the first one", async () => {
    markDoneAction.mockResolvedValue({ ok: true });
    show([A, B, C]);
    press("ArrowRight");
    click(button("Mark done"));
    await clickAndWait(button("Yes, done"));
    expect(markDoneAction).toHaveBeenCalledWith("b");
  });

  it("sends Mark open with one click, with no question, for a done task", async () => {
    markOpenAction.mockResolvedValue({ ok: true });
    show([finished("d")]);
    await clickAndWait(button("Mark open"));
    expect(markOpenAction).toHaveBeenCalledTimes(1);
    expect(markOpenAction).toHaveBeenCalledWith("d");
    expect(markDoneAction).not.toHaveBeenCalled();
  });

  it("is inactive while it is sent, says so, keeps the focus, and sends only once", async () => {
    const answer = deferred<MarkResult>();
    markDoneAction.mockReturnValue(answer.promise);
    show([A]);
    click(button("Mark done"));
    await clickAndWait(button("Yes, done"));
    const yes = button("Saving...");
    expect(yes.getAttribute("aria-disabled")).toBe("true");
    expect(button("Not yet").getAttribute("aria-disabled")).toBe("true");
    // The focus stays on the button, so it is not lost to the page if the answer is a refusal.
    expect(document.activeElement).toBe(yes);
    await clickAndWait(yes);
    click(button("Not yet"));
    expect(markDoneAction).toHaveBeenCalledTimes(1);
    expect(labels()).toEqual(["Saving...", "Not yet"]);
    await act(async () => answer.resolve({ ok: true }));
  });

  it("is inactive in the same way while Mark open is sent", async () => {
    const answer = deferred<MarkResult>();
    markOpenAction.mockReturnValue(answer.promise);
    show([finished("d")]);
    await clickAndWait(button("Mark open"));
    expect(button("Saving...").getAttribute("aria-disabled")).toBe("true");
    await clickAndWait(button("Saving..."));
    expect(markOpenAction).toHaveBeenCalledTimes(1);
    await act(async () => answer.resolve({ ok: true }));
  });
});

describe("when the request does not work out", () => {
  it("shows the sentence of a refusal as an Error line over the cards, and lets the person try again", async () => {
    markDoneAction.mockResolvedValue({ ok: false, message: GENERIC_ACTION_ERROR });
    show([A, B]);
    click(button("Mark done"));
    await clickAndWait(button("Yes, done"));
    const alert = messageArea()!.querySelector("[role=alert]")!;
    expect(alert.textContent).toBe(`Error: ${GENERIC_ACTION_ERROR}`);
    expect(alert.firstElementChild!.tagName).toBe("STRONG");
    // The question is still open, ready to be sent again, and the focus is still on the button.
    expect(labels()).toEqual(["Yes, done", "Not yet"]);
    expect(button("Yes, done").getAttribute("aria-disabled")).toBeNull();
    expect(document.activeElement).toBe(button("Yes, done"));
    // The task has not left, and nothing is waiting for it to.
    show([A, B]);
    expect(status()).toBe("1 of 2");
  });

  it("shows that a task is gone as a notice, not as an error, and it stays when the card goes", async () => {
    markDoneAction.mockResolvedValue({ ok: false, message: TASK_GONE_MESSAGE, gone: true });
    show([A, B]);
    click(button("Mark done"));
    await clickAndWait(button("Yes, done"));
    // The page is drawn again with the task out, which takes its card away.
    show([B]);
    const note = messageArea()!.querySelector("[role=status]")!;
    expect(note.textContent).toBe("That task is no longer here, so the page has been refreshed.");
    expect(messageArea()!.querySelector("[role=alert]")).toBeNull();
    expect(messageArea()!.textContent).not.toContain("Error");
  });

  it("says the task may not have been changed when no answer comes, and keeps the question", async () => {
    markDoneAction.mockRejectedValue(new Error("Invalid Server Actions request."));
    show([A]);
    click(button("Mark done"));
    await clickAndWait(button("Yes, done"));
    const text = messageArea()!.textContent!;
    expect(text).toContain("look at the list to see whether the task changed");
    expect(text).not.toContain("Invalid Server Actions");
    // One sentence, like every other failure: a single full stop, at the end.
    expect(text.match(/[.!?]/g)).toHaveLength(1);
    expect(labels()).toEqual(["Yes, done", "Not yet"]);
  });

  it("shows task text and error text as plain text", async () => {
    markDoneAction.mockResolvedValue({ ok: false, message: "<i>not italic</i>" });
    show([task("x", { name: "<b>bold</b> & more" })]);
    expect(container.querySelector(".name-card b")).toBeNull();
    click(button("Mark done"));
    await clickAndWait(button("Yes, done"));
    expect(container.querySelector(".stack-message i")).toBeNull();
    expect(messageArea()!.textContent).toBe("Error: <i>not italic</i>");
  });

  // The refusal belongs to the attempt that was given up. It does not stay over the cards after the
  // person has said Not yet, or Escape.
  it("takes the Error line away on Not yet, and on Escape", async () => {
    markDoneAction.mockResolvedValue({ ok: false, message: GENERIC_ACTION_ERROR });
    show([A, B]);
    click(button("Mark done"));
    await clickAndWait(button("Yes, done"));
    expect(messageArea()).not.toBeNull();
    click(button("Not yet"));
    expect(messageArea()).toBeNull();

    click(button("Mark done"));
    await clickAndWait(button("Yes, done"));
    expect(messageArea()).not.toBeNull();
    press("Escape", button("Yes, done"));
    expect(messageArea()).toBeNull();
  });

  it("takes the message away at the next move, and at the next request", async () => {
    markDoneAction.mockResolvedValue({ ok: false, message: GENERIC_ACTION_ERROR });
    show([A, B]);
    click(button("Mark done"));
    await clickAndWait(button("Yes, done"));
    expect(messageArea()).not.toBeNull();
    // A second try that is slow: the old message goes as soon as it is sent.
    const answer = deferred<MarkResult>();
    markDoneAction.mockReturnValue(answer.promise);
    await clickAndWait(button("Yes, done"));
    expect(messageArea()).toBeNull();
    await act(async () => answer.resolve({ ok: false, message: GENERIC_ACTION_ERROR }));
    expect(messageArea()).not.toBeNull();
    press("ArrowRight");
    expect(messageArea()).toBeNull();
  });
});

describe("after the task has left", () => {
  const active = () => document.activeElement;

  async function sendDone(): Promise<ReturnType<typeof deferred<MarkResult>>> {
    const answer = deferred<MarkResult>();
    markDoneAction.mockReturnValue(answer.promise);
    click(button("Mark done"));
    await clickAndWait(button("Yes, done"));
    return answer;
  }

  it("gives the keyboard focus to the card that took its place, when the answer comes first", async () => {
    show([A, B, C]);
    press("ArrowRight");
    const answer = await sendDone();
    await act(async () => answer.resolve({ ok: true }));
    show([A, C]);
    expect(focusCardName()).toBe("Task c");
    expect(status()).toBe("2 of 2");
    expect(active()).toBe(focusCard());
  });

  // Next draws the page again in the same response, so the new page may come before the answer.
  it("does the same when the new page comes first", async () => {
    show([A, B, C]);
    press("ArrowRight");
    const answer = await sendDone();
    show([A, C]);
    expect(focusCardName()).toBe("Task c");
    expect(active()).toBe(focusCard());
    await act(async () => answer.resolve({ ok: true }));
    expect(active()).toBe(focusCard());
  });

  it("gives it to the card before, when the last card was the one that left", async () => {
    show([A, B, C]);
    press("ArrowRight");
    press("ArrowRight");
    expect(focusCardName()).toBe("Task c");
    const answer = await sendDone();
    show([A, B]);
    await act(async () => answer.resolve({ ok: true }));
    expect(focusCardName()).toBe("Task b");
    expect(active()).toBe(focusCard());
  });

  it("gives it to the card in its place for a task marked open, on Completed", async () => {
    show([finished("d1"), finished("d2"), finished("d3")]);
    press("ArrowRight");
    const answer = deferred<MarkResult>();
    markOpenAction.mockReturnValue(answer.promise);
    await clickAndWait(button("Mark open"));
    show([finished("d1"), finished("d3")]);
    await act(async () => answer.resolve({ ok: true }));
    expect(focusCardName()).toBe("Task d3");
    expect(active()).toBe(focusCard());
  });

  it("leaves an empty stack and the page where it is when the last task was marked done", async () => {
    show([A]);
    const answer = await sendDone();
    show([]);
    await act(async () => answer.resolve({ ok: true }));
    expect(container.querySelector(".empty")!.textContent).toBe("No open tasks.");
    expect(container.querySelector(".stack")).toBeNull();
    expect(active()).toBe(document.body);
  });

  it("leaves the focus where it is when the person has gone to another control", async () => {
    show([A, B, C]);
    press("ArrowRight");
    const field = document.createElement("input");
    document.body.append(field);
    const answer = await sendDone();
    act(() => field.focus());
    show([A, C]);
    await act(async () => answer.resolve({ ok: true }));
    expect(focusCardName()).toBe("Task c");
    expect(active()).toBe(field);
  });

  it("does not take the focus when a task leaves for another reason", () => {
    show([A, B, C]);
    press("ArrowRight");
    expect(active()).toBe(focusCard());
    const field = document.createElement("input");
    document.body.append(field);
    act(() => field.focus());
    show([A, C]);
    expect(focusCardName()).toBe("Task c");
    expect(active()).toBe(field);
    // Nor from the page body.
    act(() => field.blur());
    show([A]);
    expect(active()).toBe(document.body);
  });

  // Nothing was sent and no task left: there was no task to leave. The focus belongs to wherever the
  // person was, here the page, and a new first card does not take it.
  it("does not take the focus when an empty stack gets its first task", () => {
    show([]);
    expect(container.querySelector(".stack")).toBeNull();
    show([A, B]);
    expect(focusCardName()).toBe("Task a");
    expect(active()).toBe(document.body);
  });

  it("does not take the focus later because of a request that was refused", async () => {
    markDoneAction.mockResolvedValue({ ok: false, message: GENERIC_ACTION_ERROR });
    show([A, B, C]);
    press("ArrowRight");
    click(button("Mark done"));
    await clickAndWait(button("Yes, done"));
    act(() => (document.activeElement as HTMLElement).blur());
    // The task goes some other way, such as being deleted in another tab, and the page is drawn.
    show([A, C]);
    expect(focusCardName()).toBe("Task c");
    expect(active()).toBe(document.body);
  });
});
