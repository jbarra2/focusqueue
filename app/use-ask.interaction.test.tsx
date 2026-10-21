// @vitest-environment happy-dom
import { act, createRef, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Question } from "./question";
import { useAsk } from "./use-ask";

// These tests run the hook and the component that Mark done and Clear old completed share, through a
// small harness of buttons, in a simulated page.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type HarnessProps = {
  onCancel?: () => void;
  /** What the request waits for, so a test can keep it on its way. */
  gate?: Promise<void>;
  questionRef?: React.Ref<HTMLDivElement>;
};

function Harness({ onCancel, gate, questionRef }: HarnessProps) {
  const { asking, pending, startTransition, opener, answer, ask, cancel, close, onKeyDown } =
    useAsk(onCancel);
  return (
    <div>
      {asking ? (
        <Question className="question" label="Sure?" onKeyDown={onKeyDown} ref={questionRef}>
          <button
            type="button"
            ref={answer}
            onClick={() =>
              startTransition(async () => {
                await gate;
              })
            }
          >
            {pending ? "Sending..." : "Yes"}
          </button>
          <button type="button" onClick={cancel}>
            No
          </button>
          <button type="button" onClick={() => close()}>
            Close
          </button>
          <button type="button" onClick={() => close(false)}>
            Close quietly
          </button>
        </Question>
      ) : (
        <button type="button" ref={opener} onClick={ask}>
          Open
        </button>
      )}
    </div>
  );
}

let container: HTMLDivElement;
let root: Root;
let consoleError: ReturnType<typeof vi.spyOn>;

function show(props: HarnessProps = {}) {
  act(() => root.render(<Harness {...props} />));
}

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
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

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (el) => el.textContent === label,
  );
  if (!found) throw new Error(`No ${label} button.`);
  return found;
}

const labels = () => [...container.querySelectorAll("button")].map((el) => el.textContent);

function click(element: Element) {
  act(() => (element as HTMLElement).click());
}

function escape(target: Element) {
  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("asking", () => {
  it("shows the opener, and does not take the focus by being drawn", () => {
    show();
    expect(labels()).toEqual(["Open"]);
    expect(document.activeElement).toBe(document.body);
  });

  it("does not take the focus by being drawn in StrictMode either, where effects run twice", () => {
    act(() =>
      root.render(
        <StrictMode>
          <Harness />
        </StrictMode>,
      ),
    );
    expect(document.activeElement).toBe(document.body);
    click(button("Open"));
    expect(document.activeElement).toBe(button("Yes"));
  });

  it("turns the opener into the question, and puts the focus on the answer", () => {
    show();
    click(button("Open"));
    expect(container.querySelector(".question")).not.toBeNull();
    expect(labels()).not.toContain("Open");
    expect(document.activeElement).toBe(button("Yes"));
  });

  it("puts the focus on the answer each time it is opened", () => {
    show();
    for (let round = 0; round < 3; round += 1) {
      click(button("Open"));
      expect(document.activeElement).toBe(button("Yes"));
      click(button("No"));
      expect(document.activeElement).toBe(button("Open"));
    }
  });
});

describe("the question", () => {
  it("is a group named by its own words, with the class and the ref it was given", () => {
    const ref = createRef<HTMLDivElement>();
    show({ questionRef: ref });
    click(button("Open"));
    const group = container.querySelector(".question")!;
    expect(group.getAttribute("role")).toBe("group");
    const words = group.querySelector("p")!;
    expect(words.textContent).toBe("Sure?");
    expect(group.getAttribute("aria-labelledby")).toBe(words.id);
    expect(ref.current).toBe(group);
  });
});

describe("giving it up", () => {
  it("closes, gives the focus back to the opener, and says so once", () => {
    const onCancel = vi.fn();
    show({ onCancel });
    click(button("Open"));
    click(button("No"));
    expect(labels()).toEqual(["Open"]);
    expect(document.activeElement).toBe(button("Open"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape from either answer, and keeps the key from doing anything else", () => {
    const onCancel = vi.fn();
    show({ onCancel });
    click(button("Open"));
    const event = escape(button("Yes"));
    expect(event.defaultPrevented).toBe(true);
    expect(labels()).toEqual(["Open"]);
    expect(document.activeElement).toBe(button("Open"));
    expect(onCancel).toHaveBeenCalledTimes(1);

    click(button("Open"));
    escape(button("No"));
    expect(labels()).toEqual(["Open"]);
  });

  it("ignores other keys", () => {
    show();
    click(button("Open"));
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    act(() => {
      button("Yes").dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    expect(container.querySelector(".question")).not.toBeNull();
  });

  // A request is on its way, and a refusal that has not come yet would be lost with the question.
  it("does nothing while the request is on its way, and works again when it is done", async () => {
    const gate = deferred();
    const onCancel = vi.fn();
    show({ onCancel, gate: gate.promise });
    click(button("Open"));
    await act(async () => button("Yes").click());
    expect(labels()).toContain("Sending...");

    click(button("No"));
    const event = escape(button("Sending..."));
    expect(event.defaultPrevented).toBe(false);
    expect(container.querySelector(".question")).not.toBeNull();
    expect(onCancel).not.toHaveBeenCalled();

    await act(async () => gate.resolve());
    click(button("No"));
    expect(labels()).toEqual(["Open"]);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// Holding Enter on the button that asks repeats the key, and the repeats arrive at whichever answer
// has the focus by then. A repeat is the same press and must not answer the question.
describe("a held key", () => {
  const key = (name: string, init: KeyboardEventInit) =>
    new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...init });
  const dispatch = (target: Element, event: KeyboardEvent) =>
    act(() => {
      target.dispatchEvent(event);
    });

  it("answers nothing for the repeats of a held Enter, from either button, and the question stays", () => {
    show();
    click(button("Open"));
    for (const label of ["Yes", "No"]) {
      const repeat = key("Enter", { repeat: true });
      dispatch(button(label), repeat);
      // Prevented, which is what stops the browser from pressing the button for it.
      expect(repeat.defaultPrevented).toBe(true);
    }
    expect(labels()).toEqual(["Yes", "No", "Close", "Close quietly"]);
  });

  it("leaves a separate press of Enter alone, so the answer can still be given from the keyboard", () => {
    show();
    click(button("Open"));
    const press = key("Enter", { repeat: false });
    dispatch(button("No"), press);
    expect(press.defaultPrevented).toBe(false);
  });

  it("leaves other held keys alone, so Tab and the arrows can be held", () => {
    show();
    click(button("Open"));
    for (const name of ["Tab", "ArrowRight", "ArrowDown"]) {
      const repeat = key(name, { repeat: true });
      dispatch(button("Yes"), repeat);
      expect(repeat.defaultPrevented).toBe(false);
    }
  });
});

describe("closing", () => {
  it("gives the focus back to the opener, which is what a request that worked does", () => {
    show();
    click(button("Open"));
    click(button("Close"));
    expect(labels()).toEqual(["Open"]);
    expect(document.activeElement).toBe(button("Open"));
  });

  it("can leave the focus where it is, when it was not in the question", () => {
    show();
    click(button("Open"));
    const field = document.createElement("input");
    document.body.append(field);
    act(() => field.focus());
    click(button("Close quietly"));
    expect(labels()).toEqual(["Open"]);
    expect(document.activeElement).toBe(field);
  });

  it("does not run onCancel, because nothing was given up", () => {
    const onCancel = vi.fn();
    show({ onCancel });
    click(button("Open"));
    click(button("Close"));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
