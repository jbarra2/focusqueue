// @vitest-environment happy-dom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_ACTION_ERROR } from "@/lib/action-error";
import type { ClearResult } from "@/lib/task-actions";
import { ClearOldCompleted } from "./clear-old-completed";

// These tests run the Clear old completed control in a simulated page. The Server Action is a
// stand-in that a test answers, so nothing here reaches a database.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const clearOldCompletedAction = vi.hoisted(() => vi.fn());

vi.mock("./actions", () => ({ clearOldCompletedAction }));

let container: HTMLDivElement;
let root: Root;
let consoleError: ReturnType<typeof vi.spyOn>;

function show(count: number) {
  act(() => root.render(<ClearOldCompleted count={count} />));
}

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  clearOldCompletedAction.mockReset();
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
  return [...container.querySelectorAll("button")].map((el) => el.textContent ?? "");
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (el) => el.textContent === label,
  );
  if (!found) throw new Error(`No ${label} button.`);
  return found;
}

const question = () => container.querySelector(".clear-old-question p")?.textContent ?? null;
const note = () => container.querySelector(".clear-old-note")?.textContent ?? null;

function click(element: Element) {
  act(() => (element as HTMLElement).click());
}

function clickAndWait(element: Element): Promise<void> {
  return act(async () => (element as HTMLElement).click());
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("the button", () => {
  it("says how many it would clear, and is active", () => {
    show(3);
    expect(labels()).toEqual(["Clear old completed"]);
    expect(note()).toBe("3 completed before this week.");
    expect(button("Clear old completed").getAttribute("aria-disabled")).toBeNull();
  });

  // Inactive, not disabled: a disabled button leaves the Tab order, and the keyboard focus would be
  // lost if it were on it when it became inactive. It also has to be there to be read.
  it("is inactive with nothing to clear, but still there, and does nothing", () => {
    show(0);
    const opener = button("Clear old completed");
    expect(opener.getAttribute("aria-disabled")).toBe("true");
    expect(opener.hasAttribute("disabled")).toBe(false);
    expect(opener.tabIndex).toBe(0);
    expect(note()).toBe("Nothing from before this week.");
    click(opener);
    expect(question()).toBeNull();
    expect(clearOldCompletedAction).not.toHaveBeenCalled();
  });

  it("does not take the keyboard focus by being drawn, in StrictMode too", () => {
    act(() =>
      root.render(
        <StrictMode>
          <ClearOldCompleted count={2} />
        </StrictMode>,
      ),
    );
    expect(document.activeElement).toBe(document.body);
    click(button("Clear old completed"));
    expect(document.activeElement).toBe(button("Keep them"));
  });
});

describe("asking first", () => {
  it("asks with the count, and sends nothing yet", () => {
    show(3);
    click(button("Clear old completed"));
    expect(question()).toBe("Clear 3 old completed tasks?");
    expect(labels()).toEqual(["Yes, clear", "Keep them"]);
    expect(clearOldCompletedAction).not.toHaveBeenCalled();
  });

  it("says task, not tasks, for one", () => {
    show(1);
    expect(note()).toBe("1 completed before this week.");
    click(button("Clear old completed"));
    expect(question()).toBe("Clear 1 old completed task?");
  });

  it("names the question for a screen reader, and puts the focus on the safe answer", () => {
    show(2);
    click(button("Clear old completed"));
    const group = container.querySelector(".clear-old-question")!;
    expect(group.getAttribute("role")).toBe("group");
    expect(group.getAttribute("aria-labelledby")).toBe(group.querySelector("p")!.id);
    // Keep them is the one that does not delete, so it is the one the focus starts on.
    expect(document.activeElement).toBe(button("Keep them"));
  });

  it("closes on Keep them, gives the focus back, and sends nothing", () => {
    show(2);
    click(button("Clear old completed"));
    click(button("Keep them"));
    expect(labels()).toEqual(["Clear old completed"]);
    expect(document.activeElement).toBe(button("Clear old completed"));
    expect(clearOldCompletedAction).not.toHaveBeenCalled();
  });

  it("closes on Escape in the same way", () => {
    show(2);
    click(button("Clear old completed"));
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    act(() => {
      button("Yes, clear").dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(labels()).toEqual(["Clear old completed"]);
    expect(document.activeElement).toBe(button("Clear old completed"));
  });
});

describe("a held Enter", () => {
  // Enter on Clear old completed puts the focus on Keep them, and the repeats of a held key arrive
  // there. They are the same press, so they must not give the question up, which would open it again.
  it("does not give the question up for the repeats, and leaves a separate press alone", () => {
    show(2);
    click(button("Clear old completed"));
    const repeat = new KeyboardEvent("keydown", {
      key: "Enter",
      repeat: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      button("Keep them").dispatchEvent(repeat);
    });
    expect(repeat.defaultPrevented).toBe(true);
    expect(labels()).toEqual(["Yes, clear", "Keep them"]);
    const press = new KeyboardEvent("keydown", {
      key: "Enter",
      repeat: false,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      button("Keep them").dispatchEvent(press);
    });
    expect(press.defaultPrevented).toBe(false);
  });
});

describe("clearing", () => {
  it("sends the request on Yes, clear, with nothing in it", async () => {
    clearOldCompletedAction.mockResolvedValue({ ok: true, deleted: 3 });
    show(3);
    click(button("Clear old completed"));
    await clickAndWait(button("Yes, clear"));
    expect(clearOldCompletedAction).toHaveBeenCalledTimes(1);
    // No day, no ids: the server works out what is old, and the page has nothing to forge.
    expect(clearOldCompletedAction).toHaveBeenCalledWith();
  });

  it("is inactive while it is sent, keeps the focus, and sends only once", async () => {
    const answer = deferred<ClearResult>();
    clearOldCompletedAction.mockReturnValue(answer.promise);
    show(3);
    click(button("Clear old completed"));
    await clickAndWait(button("Yes, clear"));
    const yes = button("Clearing...");
    expect(yes.getAttribute("aria-disabled")).toBe("true");
    expect(button("Keep them").getAttribute("aria-disabled")).toBe("true");
    await clickAndWait(yes);
    click(button("Keep them"));
    expect(clearOldCompletedAction).toHaveBeenCalledTimes(1);
    expect(question()).toBe("Clear 3 old completed tasks?");
    await act(async () => answer.resolve({ ok: true, deleted: 3 }));
  });

  // The page is drawn again with the count at 0 before the answer is handled, and the question
  // must not turn into "Clear 0 old completed tasks?" under the person's hand.
  it("keeps the count the question was asked with when the page is drawn again meanwhile", async () => {
    const answer = deferred<ClearResult>();
    clearOldCompletedAction.mockReturnValue(answer.promise);
    show(3);
    click(button("Clear old completed"));
    await clickAndWait(button("Yes, clear"));
    show(0);
    expect(question()).toBe("Clear 3 old completed tasks?");
    await act(async () => answer.resolve({ ok: true, deleted: 3 }));
  });

  it("closes when it worked, and leaves the inactive button with the focus on it", async () => {
    const answer = deferred<ClearResult>();
    clearOldCompletedAction.mockReturnValue(answer.promise);
    show(3);
    click(button("Clear old completed"));
    await clickAndWait(button("Yes, clear"));
    show(0);
    await act(async () => answer.resolve({ ok: true, deleted: 3 }));
    expect(labels()).toEqual(["Clear old completed"]);
    expect(note()).toBe("Nothing from before this week.");
    expect(button("Clear old completed").getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(button("Clear old completed"));
  });
});

describe("when it does not work out", () => {
  it("shows the sentence of a refusal as an Error line, keeps the question, and can be tried again", async () => {
    clearOldCompletedAction.mockResolvedValue({ ok: false, message: GENERIC_ACTION_ERROR });
    show(3);
    click(button("Clear old completed"));
    await clickAndWait(button("Yes, clear"));
    const alert = container.querySelector("[role=alert]")!;
    expect(alert.textContent).toBe(`Error: ${GENERIC_ACTION_ERROR}`);
    expect(alert.firstElementChild!.tagName).toBe("STRONG");
    expect(question()).toBe("Clear 3 old completed tasks?");
    expect(button("Yes, clear").getAttribute("aria-disabled")).toBeNull();
    // The focus has not moved: it started on the safe answer, and a refusal does not take it away.
    expect(document.activeElement).toBe(button("Keep them"));

    // The next try works, and the old sentence is gone while it is sent.
    const answer = deferred<ClearResult>();
    clearOldCompletedAction.mockReturnValue(answer.promise);
    await clickAndWait(button("Yes, clear"));
    expect(container.querySelector("[role=alert]")).toBeNull();
    await act(async () => answer.resolve({ ok: true, deleted: 3 }));
    expect(labels()).toEqual(["Clear old completed"]);
  });

  it("says the tasks may not have been cleared when no answer comes", async () => {
    clearOldCompletedAction.mockRejectedValue(new Error("Invalid Server Actions request."));
    show(3);
    click(button("Clear old completed"));
    await clickAndWait(button("Yes, clear"));
    const text = container.querySelector("[role=alert]")!.textContent!;
    expect(text).toContain("look at the count to see whether the old completed tasks were cleared");
    expect(text).not.toContain("Invalid Server Actions");
    // One sentence, like every other failure: a single full stop, at the end.
    expect(text.match(/[.!?]/g)).toHaveLength(1);
    expect(question()).toBe("Clear 3 old completed tasks?");
  });

  it("shows the sentence as plain text", async () => {
    clearOldCompletedAction.mockResolvedValue({ ok: false, message: "<i>not italic</i>" });
    show(1);
    click(button("Clear old completed"));
    await clickAndWait(button("Yes, clear"));
    expect(container.querySelector("i")).toBeNull();
    expect(container.querySelector("[role=alert]")!.textContent).toBe("Error: <i>not italic</i>");
  });

  // The refusal belongs to the attempt that was given up. It does not stay beside the button, where
  // it would look like a problem that is still there.
  it("takes the sentence away on Keep them, and on Escape", async () => {
    clearOldCompletedAction.mockResolvedValue({ ok: false, message: GENERIC_ACTION_ERROR });
    show(1);
    click(button("Clear old completed"));
    await clickAndWait(button("Yes, clear"));
    expect(container.querySelector("[role=alert]")).not.toBeNull();
    click(button("Keep them"));
    expect(container.querySelector("[role=alert]")).toBeNull();

    click(button("Clear old completed"));
    await clickAndWait(button("Yes, clear"));
    expect(container.querySelector("[role=alert]")).not.toBeNull();
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    act(() => {
      button("Yes, clear").dispatchEvent(event);
    });
    expect(container.querySelector("[role=alert]")).toBeNull();
  });
});

// A question is about the number it was asked with. If the page is drawn again with another number
// while nothing is being sent, for example because the week turned at midnight and more tasks are
// old, then Yes would delete more than was asked about, so the question closes and must be asked
// again.
describe("when the count changes while the question is open", () => {
  it("closes the question and gives the focus back, when the focus was in it", () => {
    show(3);
    click(button("Clear old completed"));
    expect(document.activeElement).toBe(button("Keep them"));
    show(12);
    expect(question()).toBeNull();
    expect(labels()).toEqual(["Clear old completed"]);
    expect(note()).toBe("12 completed before this week.");
    expect(document.activeElement).toBe(button("Clear old completed"));
    expect(clearOldCompletedAction).not.toHaveBeenCalled();
  });

  it("does not take the focus when it was somewhere else", () => {
    show(3);
    click(button("Clear old completed"));
    const field = document.createElement("input");
    document.body.append(field);
    act(() => field.focus());
    show(12);
    expect(question()).toBeNull();
    expect(document.activeElement).toBe(field);
  });

  it("keeps the question when the page is drawn again with the same count", () => {
    show(3);
    click(button("Clear old completed"));
    show(3);
    expect(question()).toBe("Clear 3 old completed tasks?");
    expect(document.activeElement).toBe(button("Keep them"));
  });

  it("leaves the question alone while the request is on its way, and closes it if it fails", async () => {
    const answer = deferred<ClearResult>();
    clearOldCompletedAction.mockReturnValue(answer.promise);
    show(3);
    click(button("Clear old completed"));
    await clickAndWait(button("Yes, clear"));
    show(12);
    expect(question()).toBe("Clear 3 old completed tasks?");
    await act(async () => answer.resolve({ ok: false, message: GENERIC_ACTION_ERROR }));
    // The refusal is still shown, and the question that no longer matches the count is not.
    expect(question()).toBeNull();
    expect(container.querySelector("[role=alert]")!.textContent).toBe(
      `Error: ${GENERIC_ACTION_ERROR}`,
    );
  });
});
