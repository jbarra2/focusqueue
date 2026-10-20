// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Group } from "@/lib/task";
import { GROUP_LIMIT_MESSAGE } from "@/lib/task-schema";
import { AddTask } from "./add-task";

// These tests run the Add a task button and dialog in a simulated page. The Server Action is a
// stand-in that a test answers, so nothing here reaches a database. Task text is made up.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const addTaskAction = vi.hoisted(() => vi.fn());

vi.mock("./actions", () => ({ addTaskAction }));

const TODAY = "2026-10-19";

// Slots 1 and 2 are taken, so the first free color is 3 (Sage).
const groups: Group[] = [
  { name: "Home", color: 1 },
  { name: "Work", color: 2 },
];

const eightGroups: Group[] = Array.from({ length: 8 }, (_, i) => ({
  name: `Group ${i + 1}`,
  color: i + 1,
}));

let container: HTMLDivElement;
let root: Root;
let consoleError: ReturnType<typeof vi.spyOn>;
let onAdded: ReturnType<typeof vi.fn>;

function show(withGroups: Group[] = groups) {
  act(() => {
    root.render(<AddTask groups={withGroups} today={TODAY} onAdded={onAdded} />);
  });
}

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  onAdded = vi.fn();
  addTaskAction.mockReset();
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

function dialog(): HTMLDialogElement {
  return container.querySelector("dialog")!;
}

function addButton(): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>("button.add-task")!;
}

function open() {
  act(() => addButton().click());
}

function formButton(label: string): HTMLButtonElement {
  const found = [...dialog().querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === label,
  );
  if (!found) throw new Error(`No ${label} button.`);
  return found;
}

/** The text field, date field or text area that has this visible label. */
function field(label: string): HTMLInputElement | HTMLTextAreaElement {
  const found = [...dialog().querySelectorAll("label")].find((el) => el.textContent === label);
  const control = found?.htmlFor ? document.getElementById(found.htmlFor) : null;
  if (!control) throw new Error(`No ${label} field.`);
  return control as HTMLInputElement | HTMLTextAreaElement;
}

function choice(label: string): HTMLInputElement {
  const found = [...dialog().querySelectorAll("label.choice")].find(
    (el) => el.textContent === label,
  );
  const input = found?.querySelector("input");
  if (!input) throw new Error(`No ${label} choice.`);
  return input;
}

function swatch(label: string): HTMLInputElement {
  const found = [...dialog().querySelectorAll("label.swatch")].find(
    (el) => el.textContent?.replace("✓", "") === label,
  );
  const input = found?.querySelector("input");
  if (!input) throw new Error(`No ${label} color.`);
  return input;
}

function swatches(): HTMLInputElement[] {
  return [...dialog().querySelectorAll<HTMLInputElement>(".swatches input")];
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

function pick(input: HTMLInputElement) {
  act(() => input.click());
}

function submitEvent(): Promise<void> {
  return act(async () => {
    dialog()
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

function sentForm(call = 0): FormData {
  return addTaskAction.mock.calls[call]?.[0] as FormData;
}

function alertText(): string | null {
  return dialog().querySelector("[role=alert]")?.textContent ?? null;
}

/** An answer for the stand-in action that a test gives when it chooses to. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Fills the required fields with a made-up task. */
function fillValid() {
  type(field("Name"), "Pay the rent");
  pick(choice("Medium"));
}

describe("the button and the dialog", () => {
  it("starts closed, with only the button", () => {
    show();
    expect(addButton().textContent).toBe("Add a task");
    expect(dialog().open).toBe(false);
    expect(dialog().querySelector("form")).toBeNull();
  });

  it("opens a dialog named by its heading, with the first field focused", () => {
    show();
    open();
    expect(dialog().open).toBe(true);
    const heading = dialog().querySelector("h2")!;
    expect(heading.textContent).toBe("Add a task");
    expect(dialog().getAttribute("aria-labelledby")).toBe(heading.id);
    expect(document.activeElement).toBe(field("Name"));
  });

  it("gives every field a visible label", () => {
    show();
    open();
    const labels = [...dialog().querySelectorAll("label:not(.choice):not(.swatch), legend")].map(
      (el) => el.textContent,
    );
    expect(labels).toEqual([
      "Name",
      "Group (optional)",
      "Due date",
      "Difficulty",
      "Description (optional)",
    ]);
    expect([...dialog().querySelectorAll("label.choice")].map((el) => el.textContent)).toEqual([
      "Low",
      "Medium",
      "High",
    ]);
  });

  it("asks for a name, a due date and a difficulty, and limits the lengths", () => {
    show();
    open();
    expect(field("Name").required).toBe(true);
    expect(field("Due date").required).toBe(true);
    for (const label of ["Low", "Medium", "High"]) expect(choice(label).required).toBe(true);
    expect(field("Group (optional)").required).toBe(false);
    expect(field("Description (optional)").required).toBe(false);
    expect(field("Name").maxLength).toBe(200);
    expect(field("Group (optional)").maxLength).toBe(100);
    expect(field("Description (optional)").maxLength).toBe(2000);
  });

  it("starts on today's date, and with nothing else filled in", () => {
    show();
    open();
    expect(field("Due date").value).toBe(TODAY);
    expect(field("Name").value).toBe("");
    expect(field("Group (optional)").value).toBe("");
    expect(field("Description (optional)").value).toBe("");
    for (const label of ["Low", "Medium", "High"]) expect(choice(label).checked).toBe(false);
  });

  it("suggests the groups that exist", () => {
    show();
    open();
    const list = dialog().querySelector("datalist")!;
    expect(field("Group (optional)").getAttribute("list")).toBe(list.id);
    expect([...list.querySelectorAll("option")].map((o) => o.value)).toEqual(["Home", "Work"]);
  });

  it("closes with Cancel, with Escape, and opens blank again each time", () => {
    show();
    open();
    type(field("Name"), "Something typed");
    type(field("Due date"), "2026-12-01");
    pick(choice("High"));
    act(() => formButton("Cancel").click());
    expect(dialog().open).toBe(false);
    expect(dialog().querySelector("form")).toBeNull();
    expect(addTaskAction).not.toHaveBeenCalled();

    open();
    expect(field("Name").value).toBe("");
    expect(field("Due date").value).toBe(TODAY);
    expect(choice("High").checked).toBe(false);

    // Escape closes a modal dialog by itself and fires a close event, which is all it does here.
    type(field("Name"), "More text");
    act(() => dialog().close());
    expect(dialog().querySelector("form")).toBeNull();
    open();
    expect(dialog().open).toBe(true);
    expect(field("Name").value).toBe("");
  });
});

describe("the group color", () => {
  it("shows no color control when there is no group", () => {
    show();
    open();
    expect(dialog().textContent).not.toContain("Group color");
    expect(swatches()).toHaveLength(0);
    type(field("Group (optional)"), "   ");
    expect(dialog().textContent).not.toContain("Group color");
  });

  it("shows the color of a group that exists, matched without case, and no grid", () => {
    show();
    open();
    type(field("Group (optional)"), "  hOmE ");
    expect(dialog().querySelector(".form-note")!.textContent).toBe("Group color: Terracotta");
    expect(swatches()).toHaveLength(0);
    expect(dialog().querySelector("[name=groupColor]")).toBeNull();
  });

  it("shows a grid of 8 colors for a new group, with the first free one chosen", () => {
    show();
    open();
    type(field("Group (optional)"), "Errands");
    expect(dialog().querySelector(".color-grid legend")!.textContent).toBe("Group color");
    expect(swatches()).toHaveLength(8);
    const names = [...dialog().querySelectorAll("label.swatch")].map((el) => el.textContent);
    expect(names.map((n) => n!.replace("✓", ""))).toEqual([
      "Terracotta, taken",
      "Mustard, taken",
      "Sage",
      "Teal",
      "Sky",
      "Lavender",
      "Rose",
      "Sand",
    ]);
    expect(swatches().map((s) => s.disabled)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(swatches().map((s) => s.checked)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
    // Each square has the slot that draws it from the theme.
    expect(
      [...dialog().querySelectorAll("label.swatch")].map((el) => el.getAttribute("data-slot")),
    ).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  });

  it("marks only the taken colors as taken", () => {
    show();
    open();
    type(field("Group (optional)"), "Errands");
    const taken = [...dialog().querySelectorAll("label.swatch[data-taken]")].map((el) =>
      el.getAttribute("data-slot"),
    );
    expect(taken).toEqual(["1", "2"]);
  });

  it("lets the person choose another free color, and not a taken one", () => {
    show();
    open();
    type(field("Group (optional)"), "Errands");
    pick(swatch("Sky"));
    expect(swatches().map((s) => s.checked)).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
    pick(swatch("Terracotta, taken"));
    expect(swatch("Sky").checked).toBe(true);
    expect(swatch("Terracotta, taken").checked).toBe(false);
  });

  it("sends the chosen color with a new group, and none with a group that exists", async () => {
    addTaskAction.mockResolvedValue({ ok: true, id: "new-id" });
    show();
    open();
    fillValid();
    type(field("Group (optional)"), "Errands");
    pick(swatch("Sky"));
    await submitEvent();
    expect(sentForm().get("groupColor")).toBe("5");
    expect(sentForm().get("group")).toBe("Errands");

    open();
    fillValid();
    type(field("Group (optional)"), "home");
    await submitEvent();
    expect(sentForm(1).get("group")).toBe("home");
    expect(sentForm(1).has("groupColor")).toBe(false);
  });

  it("sends the first free color when the person chose none", async () => {
    addTaskAction.mockResolvedValue({ ok: true, id: "new-id" });
    show();
    open();
    fillValid();
    type(field("Group (optional)"), "Errands");
    await submitEvent();
    expect(sentForm().get("groupColor")).toBe("3");
  });

  it("uses the first free color when the chosen one has been taken since", () => {
    show();
    open();
    type(field("Group (optional)"), "Errands");
    pick(swatch("Sky"));
    // Another tab gave a group Sky, and the page brought the new list.
    show([...groups, { name: "Other", color: 5 }]);
    expect(swatch("Sage").checked).toBe(true);
    expect(swatch("Sky, taken").checked).toBe(false);
  });

  it("says all 8 colors are taken for a new group, with no grid, and Add cannot be pressed", () => {
    show(eightGroups);
    open();
    expect(formButton("Add").disabled).toBe(false);
    type(field("Group (optional)"), "A ninth");
    const note = dialog().querySelector("[role=status]")!;
    expect(note.textContent).toBe(GROUP_LIMIT_MESSAGE);
    expect(swatches()).toHaveLength(0);
    expect(formButton("Add").disabled).toBe(true);
  });

  it("does not stop a task from joining a group that exists when all 8 are taken", () => {
    show(eightGroups);
    open();
    type(field("Group (optional)"), "group 3");
    expect(dialog().querySelector("[role=status]")).toBeNull();
    // "Group 3" has color slot 3, which is Sage.
    expect(dialog().querySelector(".form-note")!.textContent).toBe("Group color: Sage");
    expect(formButton("Add").disabled).toBe(false);
  });

  it("gives Add back when the new group is cleared", () => {
    show(eightGroups);
    open();
    type(field("Group (optional)"), "A ninth");
    expect(formButton("Add").disabled).toBe(true);
    type(field("Group (optional)"), "");
    expect(dialog().querySelector("[role=status]")).toBeNull();
    expect(formButton("Add").disabled).toBe(false);
  });
});

describe("sending the form", () => {
  it("sends every field to the action as typed", async () => {
    addTaskAction.mockResolvedValue({ ok: true, id: "new-id" });
    show();
    open();
    type(field("Name"), "Pay the rent");
    type(field("Group (optional)"), "Work");
    type(field("Due date"), "2026-10-23");
    pick(choice("High"));
    type(field("Description (optional)"), "Line one\nLine two");
    await submitEvent();
    expect(addTaskAction).toHaveBeenCalledTimes(1);
    const data = sentForm();
    expect(data).toBeInstanceOf(FormData);
    expect(Object.fromEntries(data.entries())).toEqual({
      name: "Pay the rent",
      group: "Work",
      dueDate: "2026-10-23",
      difficulty: "high",
      description: "Line one\nLine two",
    });
  });

  it("closes the dialog and then tells the page the id, once", async () => {
    addTaskAction.mockResolvedValue({ ok: true, id: "new-id" });
    let stillOpen: boolean | undefined;
    onAdded.mockImplementation(() => {
      stillOpen = dialog().open;
    });
    show();
    open();
    fillValid();
    await submitEvent();
    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(onAdded).toHaveBeenCalledWith("new-id");
    expect(stillOpen).toBe(false);
    expect(dialog().open).toBe(false);
    expect(dialog().querySelector("form")).toBeNull();
  });

  it("says Adding... and cannot be sent twice while the answer is awaited", async () => {
    const answer = deferred<unknown>();
    addTaskAction.mockReturnValue(answer.promise);
    show();
    open();
    fillValid();
    await submitEvent();
    expect(formButton("Adding...").disabled).toBe(true);
    // Enter in a field sends the form again, which must do nothing now.
    await submitEvent();
    expect(addTaskAction).toHaveBeenCalledTimes(1);
    expect(onAdded).not.toHaveBeenCalled();

    await act(async () => answer.resolve({ ok: true, id: "new-id" }));
    expect(onAdded).toHaveBeenCalledTimes(1);
  });

  // Closing the dialog while the form is on its way would drop a refusal that has not come back
  // yet, and a success would still move the page, as if the task had been cancelled.
  it("cannot be cancelled while it is being sent, and can be again afterwards", async () => {
    const answer = deferred<unknown>();
    addTaskAction.mockReturnValue(answer.promise);
    show();
    open();
    fillValid();
    await submitEvent();
    expect(formButton("Cancel").disabled).toBe(true);

    // Escape starts with a cancel event. It is stopped while sending.
    const whileSending = new Event("cancel", { cancelable: true });
    act(() => {
      dialog().dispatchEvent(whileSending);
    });
    expect(whileSending.defaultPrevented).toBe(true);
    expect(dialog().open).toBe(true);

    await act(async () => answer.resolve({ ok: false, message: "Enter a name." }));
    expect(alertText()).toBe("Enter a name.");
    expect(formButton("Cancel").disabled).toBe(false);
    const afterwards = new Event("cancel", { cancelable: true });
    act(() => {
      dialog().dispatchEvent(afterwards);
    });
    expect(afterwards.defaultPrevented).toBe(false);
  });

  it("lets Escape close an idle dialog", () => {
    show();
    open();
    const idle = new Event("cancel", { cancelable: true });
    act(() => {
      dialog().dispatchEvent(idle);
    });
    expect(idle.defaultPrevented).toBe(false);
  });

  it("shows the sentence of a refusal, keeps what was typed, and can be sent again", async () => {
    addTaskAction.mockResolvedValue({ ok: false, message: "Enter a name." });
    show();
    open();
    fillValid();
    type(field("Group (optional)"), "Errands");
    pick(swatch("Sky"));
    type(field("Description (optional)"), "Some words");
    await submitEvent();

    expect(alertText()).toBe("Enter a name.");
    expect(dialog().open).toBe(true);
    expect(onAdded).not.toHaveBeenCalled();
    expect(field("Name").value).toBe("Pay the rent");
    expect(field("Group (optional)").value).toBe("Errands");
    expect(field("Due date").value).toBe(TODAY);
    expect(field("Description (optional)").value).toBe("Some words");
    expect(choice("Medium").checked).toBe(true);
    expect(swatch("Sky").checked).toBe(true);
    expect(formButton("Add").disabled).toBe(false);

    // The second try works, and the old sentence is gone while it is sent.
    const answer = deferred<unknown>();
    addTaskAction.mockReturnValue(answer.promise);
    await submitEvent();
    expect(alertText()).toBeNull();
    await act(async () => answer.resolve({ ok: true, id: "new-id" }));
    expect(onAdded).toHaveBeenCalledWith("new-id");
  });

  it("shows a refusal such as a color that is taken, in the dialog and not in the page", async () => {
    addTaskAction.mockResolvedValue({
      ok: false,
      message: "Another group already uses that color, so choose a free one.",
    });
    show();
    open();
    fillValid();
    type(field("Group (optional)"), "Errands");
    await submitEvent();
    expect(alertText()).toBe("Another group already uses that color, so choose a free one.");
    expect(container.querySelectorAll("[role=alert]")).toHaveLength(1);
  });

  // The answer may have been lost after the task was saved, so the sentence must not claim that
  // nothing was. It sends the person to the list instead, so they do not add the task twice.
  it("says the task may not have been saved when no answer comes, and keeps what was typed", async () => {
    addTaskAction.mockRejectedValue(new Error("Invalid Server Actions request."));
    show();
    open();
    fillValid();
    await submitEvent();
    const message = alertText()!;
    expect(message).toContain("may not have been saved");
    expect(message).toContain("Look at the list");
    expect(message).not.toContain("nothing was saved");
    expect(message).not.toContain("Invalid Server Actions");
    expect(field("Name").value).toBe("Pay the rent");
    expect(onAdded).not.toHaveBeenCalled();
    expect(formButton("Add").disabled).toBe(false);
  });

  it("shows task text and group names as plain text", async () => {
    show([{ name: "<b>bold</b> & more", color: 1 }]);
    open();
    expect(dialog().querySelector("b")).toBeNull();
    expect(dialog().querySelector("datalist option")!.getAttribute("value")).toBe(
      "<b>bold</b> & more",
    );
    type(field("Group (optional)"), "<b>bold</b> & more");
    expect(dialog().querySelector(".form-note")!.textContent).toBe("Group color: Terracotta");
    addTaskAction.mockResolvedValue({ ok: false, message: "<i>not italic</i>" });
    fillValid();
    await submitEvent();
    expect(dialog().querySelector("i")).toBeNull();
    expect(alertText()).toBe("<i>not italic</i>");
  });
});
