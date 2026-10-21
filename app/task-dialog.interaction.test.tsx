// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Group } from "@/lib/task";
import { TaskDialog, TaskForm, useTaskDialog } from "./task-dialog";
import type { TaskFieldValues } from "./task-fields";

// These tests run the dialog and the form that Add a task, and later Edit, are made of, with values
// already in the fields and with their own labels, which Add never uses. The action is a stand-in
// that a test answers. Task text is made up.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const groups: Group[] = [
  { name: "Home", color: 1 },
  { name: "Work", color: 2 },
];

const FILLED: TaskFieldValues = {
  name: "Pay the rent",
  group: "Home",
  dueDate: "2026-10-23",
  difficulty: "high",
  description: "Before the first of the month.",
};

type HarnessProps = {
  initial?: TaskFieldValues;
  send?: (data: FormData) => Promise<{ ok: true; id: string } | { ok: false; message: string }>;
  onSaved?: (id: string) => void;
  noAnswerMessage?: string;
};

function Harness({
  initial = FILLED,
  send = async () => ({ ok: true, id: "task-1" }),
  onSaved = () => {},
  noAnswerMessage = "No answer came back.",
}: HarnessProps) {
  const dialog = useTaskDialog();
  return (
    <>
      <button type="button" onClick={dialog.show}>
        Open
      </button>
      <TaskDialog dialog={dialog} title="Edit a task">
        <TaskForm
          groups={groups}
          initial={initial}
          pending={dialog.pending}
          startTransition={dialog.startTransition}
          send={send}
          onSaved={(id) => {
            dialog.close();
            onSaved(id);
          }}
          onCancel={dialog.close}
          submitLabel="Save"
          pendingLabel="Saving..."
          noAnswerMessage={noAnswerMessage}
        />
      </TaskDialog>
    </>
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

const dialog = () => container.querySelector("dialog")!;
const open = () => act(() => container.querySelector<HTMLButtonElement>("button")!.click());

function field(label: string): HTMLInputElement | HTMLTextAreaElement {
  const found = [...dialog().querySelectorAll("label")].find((el) => el.textContent === label);
  const control =
    found && dialog().querySelector<HTMLInputElement>(`#${CSS.escape(found.htmlFor)}`);
  if (!control) throw new Error(`No ${label} field.`);
  return control;
}

function formButton(label: string): HTMLButtonElement {
  const found = [...dialog().querySelectorAll<HTMLButtonElement>(".form-actions button")].find(
    (el) => el.textContent === label,
  );
  if (!found) throw new Error(`No ${label} button.`);
  return found;
}

function type(control: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function submit(): Promise<void> {
  return act(async () => {
    dialog()
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("the dialog", () => {
  it("is named by its heading, which says what it was given", () => {
    show();
    open();
    const heading = dialog().querySelector("h2")!;
    expect(heading.textContent).toBe("Edit a task");
    expect(dialog().getAttribute("aria-labelledby")).toBe(heading.id);
  });

  // The browser says a dialog was closed with a close event a moment after it was. When Escape
  // closes it, that event is how the form is taken out of the page.
  it("takes the form out of the page when the browser closes it by itself, as Escape does", () => {
    show();
    open();
    act(() => {
      dialog().close();
      dialog().dispatchEvent(new Event("close"));
    });
    expect(dialog().open).toBe(false);
    expect(dialog().querySelector("form")).toBeNull();
  });

  // Closed and shown again before the close event of the first closing arrives, which a person
  // cannot do, but a script can: that event is stale and must not take the form from the open dialog.
  it("keeps the form when a close event arrives after the dialog was shown again", () => {
    show();
    open();
    act(() => {
      formButton("Cancel").click();
      container.querySelector<HTMLButtonElement>("button")!.click();
    });
    expect(dialog().open).toBe(true);
    act(() => {
      dialog().dispatchEvent(new Event("close"));
    });
    expect(dialog().open).toBe(true);
    expect(dialog().querySelector("form")).not.toBeNull();
  });

  it("is shown closed, with no form in the page, until it is opened", () => {
    show();
    expect(dialog().open).toBe(false);
    expect(dialog().querySelector("form")).toBeNull();
    open();
    expect(dialog().open).toBe(true);
    expect(dialog().querySelector("form")).not.toBeNull();
  });
});

describe("a form that starts with a task in it", () => {
  it("has every field filled in, and the first field has the focus", () => {
    show();
    open();
    expect((field("Name") as HTMLInputElement).value).toBe("Pay the rent");
    expect((field("Group (optional)") as HTMLInputElement).value).toBe("Home");
    expect((field("Due date") as HTMLInputElement).value).toBe("2026-10-23");
    expect((field("Description (optional)") as HTMLTextAreaElement).value).toBe(
      "Before the first of the month.",
    );
    const checked = [...dialog().querySelectorAll<HTMLInputElement>("input[name=difficulty]")].find(
      (input) => input.checked,
    );
    expect(checked?.value).toBe("high");
    expect(document.activeElement).toBe(field("Name"));
  });

  it("shows the color of a group that exists, and no color grid", () => {
    show();
    open();
    expect(dialog().querySelector(".form-note")!.textContent).toBe("Group color: Terracotta");
    expect(dialog().querySelector(".color-grid")).toBeNull();
  });

  it("shows the color grid for a group that is new, with the first free color chosen", () => {
    show({ initial: { ...FILLED, group: "Errands" } });
    open();
    expect(dialog().querySelector(".form-note")).toBeNull();
    const chosen = dialog().querySelector<HTMLInputElement>(".swatches input:checked");
    expect(chosen?.value).toBe("3");
  });

  it("is new each time the dialog is opened, so a draft does not carry over", () => {
    show();
    open();
    type(field("Name"), "Something else");
    act(() => formButton("Cancel").click());
    expect(dialog().querySelector("form")).toBeNull();
    open();
    expect((field("Name") as HTMLInputElement).value).toBe("Pay the rent");
  });

  it("starts empty when it is given nothing, which is how Add uses it", () => {
    show({
      initial: { name: "", group: "", dueDate: "2026-10-19", difficulty: "", description: "" },
    });
    open();
    expect((field("Name") as HTMLInputElement).value).toBe("");
    expect((field("Due date") as HTMLInputElement).value).toBe("2026-10-19");
    expect(
      [...dialog().querySelectorAll<HTMLInputElement>("input[name=difficulty]")].some(
        (i) => i.checked,
      ),
    ).toBe(false);
    expect(dialog().querySelector(".form-note")).toBeNull();
  });
});

// Holding Enter on the button that opened the dialog repeats the key, and the repeats arrive at the
// first field, where Enter sends the form. A repeat is the same press and must not send it.
describe("a held Enter", () => {
  const enter = (target: Element, init: KeyboardEventInit) => {
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
      ...init,
    });
    act(() => {
      target.dispatchEvent(event);
    });
    return event;
  };

  it("does not send the form for the repeats that arrive at a field", () => {
    show();
    open();
    // Prevented, which is what stops the browser from sending the form for it.
    expect(enter(field("Name"), { repeat: true }).defaultPrevented).toBe(true);
    expect(enter(field("Group (optional)"), { repeat: true }).defaultPrevented).toBe(true);
  });

  it("leaves a separate press alone, so Enter still sends the form from the keyboard", () => {
    show();
    open();
    expect(enter(field("Name"), { repeat: false }).defaultPrevented).toBe(false);
  });

  it("leaves a repeat in the description alone, where Enter is a new line", () => {
    show();
    open();
    expect(enter(field("Description (optional)"), { repeat: true }).defaultPrevented).toBe(false);
  });

  it("leaves other held keys alone", () => {
    show();
    open();
    for (const key of ["Tab", "ArrowDown", "Backspace"]) {
      const event = new KeyboardEvent("keydown", {
        key,
        repeat: true,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        field("Name").dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(false);
    }
  });
});

describe("sending", () => {
  it("sends what is in the fields, changed or not, and hands the id on after it closes", async () => {
    const send = vi.fn(async (_data: FormData) => ({ ok: true as const, id: "task-9" }));
    const onSaved = vi.fn();
    show({ send, onSaved });
    open();
    type(field("Name"), "Pay the rent and the water");
    await submit();
    const data = send.mock.calls[0][0];
    expect(Object.fromEntries(data.entries())).toEqual({
      name: "Pay the rent and the water",
      group: "Home",
      dueDate: "2026-10-23",
      difficulty: "high",
      description: "Before the first of the month.",
    });
    expect(onSaved).toHaveBeenCalledWith("task-9");
    expect(dialog().open).toBe(false);
  });

  it("uses the button labels it was given, and says so while sending", async () => {
    let finish!: (value: { ok: true; id: string }) => void;
    const send = vi.fn(
      () =>
        new Promise<{ ok: true; id: string }>((resolve) => {
          finish = resolve;
        }),
    );
    show({ send });
    open();
    expect(formButton("Save")).toBeDefined();
    await submit();
    expect(formButton("Saving...").disabled).toBe(true);
    expect(formButton("Cancel").disabled).toBe(true);
    await act(async () => finish({ ok: true, id: "task-1" }));
  });

  it("shows a refusal as an Error line, and keeps what was typed", async () => {
    const send = vi.fn(async () => ({ ok: false as const, message: "Enter a name." }));
    const onSaved = vi.fn();
    show({ send, onSaved });
    open();
    type(field("Name"), "Pay the rent and the water");
    await submit();
    expect(dialog().querySelector("[role=alert]")!.textContent).toBe("Error: Enter a name.");
    expect((field("Name") as HTMLInputElement).value).toBe("Pay the rent and the water");
    expect(onSaved).not.toHaveBeenCalled();
    expect(dialog().open).toBe(true);
  });

  it("says what it was told to say when no answer comes", async () => {
    const send = vi.fn(async () => {
      throw new Error("Invalid Server Actions request.");
    });
    show({ send, noAnswerMessage: "Nothing came back, so check the list." });
    open();
    await submit();
    expect(dialog().querySelector("[role=alert]")!.textContent).toBe(
      "Error: Nothing came back, so check the list.",
    );
  });

  it("does not close on Escape while it is sending, so a refusal is not lost", async () => {
    let finish!: (value: { ok: true; id: string }) => void;
    show({
      send: () =>
        new Promise<{ ok: true; id: string }>((resolve) => {
          finish = resolve;
        }),
    });
    open();
    await submit();
    const sending = new Event("cancel", { cancelable: true });
    act(() => {
      dialog().dispatchEvent(sending);
    });
    expect(sending.defaultPrevented).toBe(true);
    await act(async () => finish({ ok: true, id: "task-1" }));
    const idle = new Event("cancel", { cancelable: true });
    act(() => {
      dialog().dispatchEvent(idle);
    });
    expect(idle.defaultPrevented).toBe(false);
  });
});
