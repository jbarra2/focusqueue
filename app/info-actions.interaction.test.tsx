// @vitest-environment happy-dom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_ACTION_ERROR } from "@/lib/action-error";
import type { Group, Task } from "@/lib/task";
import { TASK_GONE_MESSAGE, type DeleteResult, type UpdateTaskResult } from "@/lib/task-actions";
import { CardStack } from "./card-stack";

// These tests run the stack with the buttons on its info card, Edit and Delete, in a simulated page.
// The Server Actions are stand-ins that a test answers, so nothing here reaches a database. Task
// text is made up. A redraw of the page, which is what Next does after a write, is a second call to
// show().

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const updateTaskAction = vi.hoisted(() => vi.fn());
const deleteTaskAction = vi.hoisted(() => vi.fn());
const markDoneAction = vi.hoisted(() => vi.fn());
const markOpenAction = vi.hoisted(() => vi.fn());

vi.mock("./actions", () => ({
  updateTaskAction,
  deleteTaskAction,
  markDoneAction,
  markOpenAction,
}));

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

// A task with every field filled in, for the form to start with.
const RENT = task("rent", {
  name: "Pay the rent",
  group: "Home",
  dueDate: "2026-10-23",
  difficulty: "high",
  description: "Before the first of the month.",
});

const GROUPS: Group[] = [
  { name: "Home", color: 1 },
  { name: "Work", color: 2 },
];
const EIGHT: Group[] = Array.from({ length: 8 }, (_, n) => ({
  name: `Group ${n + 1}`,
  color: n + 1,
}));

let container: HTMLDivElement;
let root: Root;
let consoleError: ReturnType<typeof vi.spyOn>;

function stack(tasks: Task[], groups: Group[]) {
  return (
    <CardStack
      tasks={tasks}
      groups={groups}
      today={today}
      doNowId={tasks[0]?.id ?? null}
      label="Up next"
      emptyMessage="No open tasks."
    />
  );
}

function show(tasks: Task[], groups: Group[] = GROUPS) {
  act(() => root.render(stack(tasks, groups)));
}

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  updateTaskAction.mockReset();
  deleteTaskAction.mockReset();
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

const infoLabels = () =>
  [...container.querySelectorAll(".info-card .card-actions button")].map(
    (button) => button.textContent ?? "",
  );

function infoButton(label: string): HTMLButtonElement {
  const found = [
    ...container.querySelectorAll<HTMLButtonElement>(".info-card .card-actions button"),
  ].find((el) => el.textContent === label);
  if (!found) throw new Error(`No ${label} button.`);
  return found;
}

const dialog = () => container.querySelector("dialog")!;

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

const focusCardName = () => container.querySelector(".name-card h2")?.textContent ?? "";
const messageArea = () => container.querySelector(".stack-message");
const focusCard = () => container.querySelector(".name-card");
const active = () => document.activeElement;
const openDialogs = () => container.querySelectorAll("dialog[open]");

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

describe("the buttons on the info card", () => {
  it("are Edit and Delete, for an open task and for a done one", () => {
    show([A]);
    expect(infoLabels()).toEqual(["Edit", "Delete"]);
    show([finished("d")]);
    expect(infoLabels()).toEqual(["Edit", "Delete"]);
  });

  it("are on the info card only, once, and not on a stacked card", () => {
    show([A, B, C]);
    expect(container.querySelectorAll(".info-card .card-actions")).toHaveLength(1);
    expect(container.querySelectorAll(".stacked-card .card-actions")).toHaveLength(0);
    expect(container.querySelectorAll("dialog")).toHaveLength(1);
  });

  it("do not take the keyboard focus by being drawn, in StrictMode too", () => {
    show([A, B]);
    expect(active()).toBe(document.body);
    act(() => root.render(<StrictMode>{stack([A, B], GROUPS)}</StrictMode>));
    expect(active()).toBe(document.body);
  });

  it("tell a screen reader that Edit opens a dialog", () => {
    show([A]);
    expect(infoButton("Edit").getAttribute("aria-haspopup")).toBe("dialog");
  });
});

describe("Edit", () => {
  it("opens a dialog with the task in its fields, and the focus on the name", () => {
    show([RENT]);
    expect(openDialogs()).toHaveLength(0);
    click(infoButton("Edit"));
    expect(openDialogs()).toHaveLength(1);
    expect(dialog().querySelector("h2")!.textContent).toBe("Edit a task");
    expect((field("Name") as HTMLInputElement).value).toBe("Pay the rent");
    expect((field("Group (optional)") as HTMLInputElement).value).toBe("Home");
    expect((field("Due date") as HTMLInputElement).value).toBe("2026-10-23");
    expect((field("Description (optional)") as HTMLTextAreaElement).value).toBe(
      "Before the first of the month.",
    );
    const checked = dialog().querySelector<HTMLInputElement>("input[name=difficulty]:checked");
    expect(checked?.value).toBe("high");
    expect(active()).toBe(field("Name"));
    expect(formButton("Save")).toBeDefined();
  });

  it("starts with an empty group field for a task that has no group", () => {
    show([A]);
    click(infoButton("Edit"));
    expect((field("Group (optional)") as HTMLInputElement).value).toBe("");
  });

  it("sends the id of the task and every field on Save, once, and closes", async () => {
    updateTaskAction.mockResolvedValue({ ok: true, id: "rent" });
    show([RENT, B]);
    click(infoButton("Edit"));
    type(field("Name"), "Pay the rent and the water");
    await submit();
    expect(updateTaskAction).toHaveBeenCalledTimes(1);
    const [id, data] = updateTaskAction.mock.calls[0] as [string, FormData];
    expect(id).toBe("rent");
    expect(Object.fromEntries(data.entries())).toEqual({
      name: "Pay the rent and the water",
      group: "Home",
      dueDate: "2026-10-23",
      difficulty: "high",
      description: "Before the first of the month.",
    });
    expect(openDialogs()).toHaveLength(0);
  });

  it("sends the id of the task that has the focus, not the first one", async () => {
    updateTaskAction.mockResolvedValue({ ok: true, id: "b" });
    show([A, B, C]);
    press("ArrowRight");
    click(infoButton("Edit"));
    expect((field("Name") as HTMLInputElement).value).toBe("Task b");
    await submit();
    expect(updateTaskAction.mock.calls[0][0]).toBe("b");
  });

  it("sends nothing on Cancel, and a draft does not carry over to the next time", () => {
    show([RENT]);
    click(infoButton("Edit"));
    type(field("Name"), "Something else");
    click(formButton("Cancel"));
    expect(updateTaskAction).not.toHaveBeenCalled();
    expect(openDialogs()).toHaveLength(0);
    click(infoButton("Edit"));
    expect((field("Name") as HTMLInputElement).value).toBe("Pay the rent");
  });

  it("is inactive while it is sent, says so, and sends only once", async () => {
    const answer = deferred<UpdateTaskResult>();
    updateTaskAction.mockReturnValue(answer.promise);
    show([RENT]);
    click(infoButton("Edit"));
    await submit();
    expect(formButton("Saving...").disabled).toBe(true);
    expect(formButton("Cancel").disabled).toBe(true);
    await submit();
    expect(updateTaskAction).toHaveBeenCalledTimes(1);
    await act(async () => answer.resolve({ ok: true, id: "rent" }));
    expect(openDialogs()).toHaveLength(0);
  });

  it("shows a refusal in the dialog, keeps what was typed, and does not use the line over the cards", async () => {
    updateTaskAction.mockResolvedValue({ ok: false, message: "Enter a name." });
    show([RENT]);
    click(infoButton("Edit"));
    type(field("Name"), "Pay the rent and the water");
    await submit();
    expect(dialog().querySelector("[role=alert]")!.textContent).toBe("Error: Enter a name.");
    expect((field("Name") as HTMLInputElement).value).toBe("Pay the rent and the water");
    expect(openDialogs()).toHaveLength(1);
    expect(messageArea()).toBeNull();
  });

  it("says the task may not have been saved when no answer comes, in one sentence", async () => {
    updateTaskAction.mockRejectedValue(new Error("Invalid Server Actions request."));
    show([RENT]);
    click(infoButton("Edit"));
    await submit();
    const text = dialog().querySelector("[role=alert]")!.textContent!;
    expect(text).toContain("look at the list to see whether the task was saved");
    expect(text).not.toContain("Invalid Server Actions");
    expect(text.replace("Error: ", "").match(/[.!?]/g)).toHaveLength(1);
    expect(openDialogs()).toHaveLength(1);
  });

  it("shows task text as plain text, in the fields and in a refusal", async () => {
    updateTaskAction.mockResolvedValue({ ok: false, message: "<i>not italic</i>" });
    show([task("x", { name: "<b>bold</b> & more" })]);
    click(infoButton("Edit"));
    expect((field("Name") as HTMLInputElement).value).toBe("<b>bold</b> & more");
    await submit();
    expect(dialog().querySelector("b, i")).toBeNull();
    expect(dialog().querySelector("[role=alert]")!.textContent).toBe("Error: <i>not italic</i>");
  });

  describe("when the task is gone", () => {
    it("says so above the cards as a notice, and it stays when the card and the dialog go", async () => {
      updateTaskAction.mockResolvedValue({ ok: false, message: TASK_GONE_MESSAGE, gone: true });
      show([A, B]);
      click(infoButton("Edit"));
      await submit();
      // The page is drawn again with the task out, which takes its card and its dialog away.
      show([B]);
      expect(openDialogs()).toHaveLength(0);
      const note = messageArea()!.querySelector("[role=status]")!;
      expect(note.textContent).toBe("That task is no longer here, so the page has been refreshed.");
      expect(messageArea()!.querySelector("[role=alert]")).toBeNull();
    });
  });

  describe("with every group color taken", () => {
    it("says what a new group needs, and leaves Save on, because the task may be the last of its group", async () => {
      updateTaskAction.mockResolvedValue({ ok: true, id: "a" });
      show([A], EIGHT);
      click(infoButton("Edit"));
      type(field("Group (optional)"), "Brand new");
      const notice = dialog().querySelector(".form-notice")!;
      expect(notice.getAttribute("role")).toBe("status");
      expect(notice.textContent).toBe(
        "All 8 group colors are taken, so a new group only works when this is the last task in its group, and otherwise you can choose an existing group, leave the group empty, or delete an old group's tasks to free its color.",
      );
      expect(dialog().querySelector(".color-grid")).toBeNull();
      expect(formButton("Save").disabled).toBe(false);
      await submit();
      expect(updateTaskAction).toHaveBeenCalledTimes(1);
      expect(updateTaskAction.mock.calls[0][1].get("group")).toBe("Brand new");
    });

    it("has nothing to say for a group that exists, or for no group", () => {
      show([A], EIGHT);
      click(infoButton("Edit"));
      type(field("Group (optional)"), "Group 3");
      expect(dialog().querySelector(".form-notice")).toBeNull();
      expect(dialog().querySelector(".form-note")!.textContent).toContain("Group color:");
      type(field("Group (optional)"), "");
      expect(dialog().querySelector(".form-notice")).toBeNull();
    });

    it("shows the sentence the server gives when the task was not the last of its group", async () => {
      updateTaskAction.mockResolvedValue({
        ok: false,
        message: "All 8 group colors are taken.",
      });
      show([A], EIGHT);
      click(infoButton("Edit"));
      type(field("Group (optional)"), "Brand new");
      await submit();
      expect(dialog().querySelector("[role=alert]")!.textContent).toBe(
        "Error: All 8 group colors are taken.",
      );
    });
  });

  it("shows the color grid for a new group when a color is free, as Add does", () => {
    show([A], GROUPS);
    click(infoButton("Edit"));
    type(field("Group (optional)"), "Errands");
    expect(dialog().querySelector(".form-notice")).toBeNull();
    expect(dialog().querySelector(".color-grid")).not.toBeNull();
  });
});

describe("Delete", () => {
  const question = () => container.querySelector(".info-card .card-question")!;

  it("asks first, names the question for a screen reader, and puts the focus on Keep it", () => {
    show([A]);
    click(infoButton("Delete"));
    expect(infoLabels()).toEqual(["Yes, delete", "Keep it"]);
    expect(question().getAttribute("role")).toBe("group");
    const words = question().querySelector("p")!;
    expect(words.textContent).toBe("Delete this task?");
    expect(question().getAttribute("aria-labelledby")).toBe(words.id);
    expect(active()).toBe(infoButton("Keep it"));
    expect(deleteTaskAction).not.toHaveBeenCalled();
  });

  it("closes on Keep it and gives the focus back to Delete, and sends nothing", () => {
    show([A]);
    click(infoButton("Delete"));
    click(infoButton("Keep it"));
    expect(infoLabels()).toEqual(["Edit", "Delete"]);
    expect(active()).toBe(infoButton("Delete"));
    expect(deleteTaskAction).not.toHaveBeenCalled();
  });

  it("closes on Escape in the same way, from either button", () => {
    show([A]);
    click(infoButton("Delete"));
    const event = press("Escape", infoButton("Yes, delete"));
    expect(event.defaultPrevented).toBe(true);
    expect(infoLabels()).toEqual(["Edit", "Delete"]);
    expect(active()).toBe(infoButton("Delete"));
    click(infoButton("Delete"));
    press("Escape", infoButton("Keep it"));
    expect(infoLabels()).toEqual(["Edit", "Delete"]);
    expect(deleteTaskAction).not.toHaveBeenCalled();
  });

  it("is not left open on a card that was moved away from", () => {
    show([A, B]);
    click(infoButton("Delete"));
    expect(infoLabels()).toEqual(["Yes, delete", "Keep it"]);
    press("ArrowRight");
    expect(focusCardName()).toBe("Task b");
    expect(infoLabels()).toEqual(["Edit", "Delete"]);
    press("ArrowLeft");
    expect(focusCardName()).toBe("Task a");
    expect(infoLabels()).toEqual(["Edit", "Delete"]);
  });

  it("sends the id of the task on Yes, delete, once", async () => {
    deleteTaskAction.mockResolvedValue({ ok: true });
    show([A, B]);
    click(infoButton("Delete"));
    await clickAndWait(infoButton("Yes, delete"));
    expect(deleteTaskAction).toHaveBeenCalledTimes(1);
    expect(deleteTaskAction).toHaveBeenCalledWith("a");
  });

  it("sends the id of the task that has the focus, not the first one", async () => {
    deleteTaskAction.mockResolvedValue({ ok: true });
    show([A, B, C]);
    press("ArrowRight");
    click(infoButton("Delete"));
    await clickAndWait(infoButton("Yes, delete"));
    expect(deleteTaskAction).toHaveBeenCalledWith("b");
  });

  it("is inactive while it is sent, says so, and sends only once", async () => {
    const answer = deferred<DeleteResult>();
    deleteTaskAction.mockReturnValue(answer.promise);
    show([A]);
    click(infoButton("Delete"));
    await clickAndWait(infoButton("Yes, delete"));
    const yes = infoButton("Deleting...");
    expect(yes.getAttribute("aria-disabled")).toBe("true");
    expect(infoButton("Keep it").getAttribute("aria-disabled")).toBe("true");
    await clickAndWait(yes);
    click(infoButton("Keep it"));
    press("Escape", infoButton("Keep it"));
    expect(deleteTaskAction).toHaveBeenCalledTimes(1);
    expect(infoLabels()).toEqual(["Deleting...", "Keep it"]);
    await act(async () => answer.resolve({ ok: true }));
  });

  // Holding Enter on Delete repeats the key, and the repeats arrive at Keep it once it has the focus.
  // A repeat is the same press, so it must not answer the question, either way.
  describe("a held key", () => {
    const enter = (init: KeyboardEventInit) =>
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...init });

    it("does not answer the question when its repeats arrive, so the question stays open", () => {
      show([A]);
      click(infoButton("Delete"));
      for (const label of ["Keep it", "Yes, delete"]) {
        const repeat = enter({ repeat: true });
        act(() => {
          infoButton(label).dispatchEvent(repeat);
        });
        // Prevented, which is what stops the browser from pressing the button for it.
        expect(repeat.defaultPrevented).toBe(true);
      }
      expect(infoLabels()).toEqual(["Yes, delete", "Keep it"]);
      expect(deleteTaskAction).not.toHaveBeenCalled();
    });

    it("leaves a separate press alone, so the answer can still be given from the keyboard", () => {
      show([A]);
      click(infoButton("Delete"));
      const first = enter({ repeat: false });
      act(() => {
        infoButton("Keep it").dispatchEvent(first);
      });
      expect(first.defaultPrevented).toBe(false);
    });
  });

  describe("when the request does not work out", () => {
    it("shows the sentence of a refusal as an Error line over the cards, and keeps the question", async () => {
      deleteTaskAction.mockResolvedValue({ ok: false, message: GENERIC_ACTION_ERROR });
      show([A, B]);
      click(infoButton("Delete"));
      await clickAndWait(infoButton("Yes, delete"));
      const alert = messageArea()!.querySelector("[role=alert]")!;
      expect(alert.textContent).toBe(`Error: ${GENERIC_ACTION_ERROR}`);
      expect(infoLabels()).toEqual(["Yes, delete", "Keep it"]);
      expect(infoButton("Yes, delete").getAttribute("aria-disabled")).toBeNull();
      // The task has not left, and nothing is waiting for it to.
      show([A, B]);
      expect(focusCardName()).toBe("Task a");
    });

    it("shows that a task is gone as a notice, and it stays when the card goes", async () => {
      deleteTaskAction.mockResolvedValue({ ok: false, message: TASK_GONE_MESSAGE, gone: true });
      show([A, B]);
      click(infoButton("Delete"));
      await clickAndWait(infoButton("Yes, delete"));
      show([B]);
      const note = messageArea()!.querySelector("[role=status]")!;
      expect(note.textContent).toBe("That task is no longer here, so the page has been refreshed.");
      expect(messageArea()!.textContent).not.toContain("Error");
    });

    it("says the task may not have been deleted when no answer comes, in one sentence", async () => {
      deleteTaskAction.mockRejectedValue(new Error("Invalid Server Actions request."));
      show([A]);
      click(infoButton("Delete"));
      await clickAndWait(infoButton("Yes, delete"));
      const text = messageArea()!.textContent!;
      expect(text).toContain("look at the list to see whether the task was deleted");
      expect(text).not.toContain("Invalid Server Actions");
      expect(text.match(/[.!?]/g)).toHaveLength(1);
      expect(infoLabels()).toEqual(["Yes, delete", "Keep it"]);
    });

    it("takes the Error line away on Keep it, on Escape, at the next request, and at the next move", async () => {
      deleteTaskAction.mockResolvedValue({ ok: false, message: GENERIC_ACTION_ERROR });
      show([A, B]);
      click(infoButton("Delete"));
      await clickAndWait(infoButton("Yes, delete"));
      expect(messageArea()).not.toBeNull();
      click(infoButton("Keep it"));
      expect(messageArea()).toBeNull();

      click(infoButton("Delete"));
      await clickAndWait(infoButton("Yes, delete"));
      press("Escape", infoButton("Keep it"));
      expect(messageArea()).toBeNull();

      click(infoButton("Delete"));
      await clickAndWait(infoButton("Yes, delete"));
      const answer = deferred<DeleteResult>();
      deleteTaskAction.mockReturnValue(answer.promise);
      await clickAndWait(infoButton("Yes, delete"));
      expect(messageArea()).toBeNull();
      await act(async () => answer.resolve({ ok: false, message: GENERIC_ACTION_ERROR }));
      expect(messageArea()).not.toBeNull();
      press("ArrowRight");
      expect(messageArea()).toBeNull();
    });
  });
});

describe("after the task has left", () => {
  async function sendDelete(): Promise<ReturnType<typeof deferred<DeleteResult>>> {
    const answer = deferred<DeleteResult>();
    deleteTaskAction.mockReturnValue(answer.promise);
    click(infoButton("Delete"));
    await clickAndWait(infoButton("Yes, delete"));
    return answer;
  }

  async function sendEdit(): Promise<ReturnType<typeof deferred<UpdateTaskResult>>> {
    const answer = deferred<UpdateTaskResult>();
    updateTaskAction.mockReturnValue(answer.promise);
    click(infoButton("Edit"));
    await submit();
    return answer;
  }

  it("gives the keyboard focus to the card that took its place after a delete, when the answer comes first", async () => {
    show([A, B, C]);
    press("ArrowRight");
    const answer = await sendDelete();
    await act(async () => answer.resolve({ ok: true }));
    show([A, C]);
    expect(focusCardName()).toBe("Task c");
    expect(active()).toBe(focusCard());
  });

  it("does the same when the new page comes first", async () => {
    show([A, B, C]);
    press("ArrowRight");
    const answer = await sendDelete();
    show([A, C]);
    expect(focusCardName()).toBe("Task c");
    expect(active()).toBe(focusCard());
    await act(async () => answer.resolve({ ok: true }));
    expect(active()).toBe(focusCard());
  });

  it("gives it to the card before, when the last card was the one that was deleted", async () => {
    show([A, B, C]);
    press("ArrowRight");
    press("ArrowRight");
    const answer = await sendDelete();
    show([A, B]);
    await act(async () => answer.resolve({ ok: true }));
    expect(focusCardName()).toBe("Task b");
    expect(active()).toBe(focusCard());
  });

  it("leaves an empty stack and the page where it is when the last task was deleted", async () => {
    show([A]);
    const answer = await sendDelete();
    show([]);
    await act(async () => answer.resolve({ ok: true }));
    expect(container.querySelector(".empty")!.textContent).toBe("No open tasks.");
    expect(active()).toBe(document.body);
  });

  it("gives it to the card in its place after an edit that took the task out of the view, answer first", async () => {
    show([A, B, C]);
    press("ArrowRight");
    const answer = await sendEdit();
    await act(async () => answer.resolve({ ok: true, id: "b" }));
    expect(openDialogs()).toHaveLength(0);
    show([A, C]);
    expect(focusCardName()).toBe("Task c");
    expect(active()).toBe(focusCard());
  });

  it("does the same when the new page comes first, which takes the dialog away with the card", async () => {
    show([A, B, C]);
    press("ArrowRight");
    const answer = await sendEdit();
    show([A, C]);
    expect(openDialogs()).toHaveLength(0);
    expect(focusCardName()).toBe("Task c");
    expect(active()).toBe(focusCard());
    await act(async () => answer.resolve({ ok: true, id: "b" }));
    expect(active()).toBe(focusCard());
  });

  it("gives it to the card in its place when the task was gone, so the person is not left on the page", async () => {
    show([A, B, C]);
    press("ArrowRight");
    updateTaskAction.mockResolvedValue({ ok: false, message: TASK_GONE_MESSAGE, gone: true });
    click(infoButton("Edit"));
    await submit();
    show([A, C]);
    expect(focusCardName()).toBe("Task c");
    expect(active()).toBe(focusCard());
  });

  it("does not take the focus later after an edit that worked and left the task where it was", async () => {
    show([A, B, C]);
    press("ArrowRight");
    const answer = await sendEdit();
    await act(async () => answer.resolve({ ok: true, id: "b" }));
    // The page is drawn again with the change, and the task is still in it. Awaited, because the
    // save finishes in a later tick of the simulated page, and a redraw that does not wait is held back.
    await act(async () => root.render(stack([A, B, C], GROUPS)));
    expect(focusCardName()).toBe("Task b");
    act(() => (document.activeElement as HTMLElement).blur());
    // The task goes some other way, such as being deleted in another tab, and the page is drawn.
    show([A, C]);
    expect(focusCardName()).toBe("Task c");
    expect(active()).toBe(document.body);
  });

  it("does not take the focus later because of a refused edit", async () => {
    show([A, B, C]);
    press("ArrowRight");
    updateTaskAction.mockResolvedValue({ ok: false, message: "Enter a name." });
    click(infoButton("Edit"));
    await submit();
    click(formButton("Cancel"));
    act(() => (document.activeElement as HTMLElement).blur());
    show([A, C]);
    expect(active()).toBe(document.body);
  });

  it("does not take the focus later because of an edit that got no answer", async () => {
    show([A, B, C]);
    press("ArrowRight");
    updateTaskAction.mockRejectedValue(new Error("Invalid Server Actions request."));
    click(infoButton("Edit"));
    await submit();
    click(formButton("Cancel"));
    act(() => (document.activeElement as HTMLElement).blur());
    show([A, C]);
    expect(active()).toBe(document.body);
  });

  it("does not take the focus later because of a refused delete, or one with no answer", async () => {
    show([A, B, C]);
    press("ArrowRight");
    deleteTaskAction.mockResolvedValue({ ok: false, message: GENERIC_ACTION_ERROR });
    click(infoButton("Delete"));
    await clickAndWait(infoButton("Yes, delete"));
    act(() => (document.activeElement as HTMLElement).blur());
    show([A, C]);
    expect(active()).toBe(document.body);

    show([A, B, C]);
    press("ArrowRight");
    deleteTaskAction.mockRejectedValue(new Error("Invalid Server Actions request."));
    click(infoButton("Delete"));
    await clickAndWait(infoButton("Yes, delete"));
    act(() => (document.activeElement as HTMLElement).blur());
    show([A]);
    expect(active()).toBe(document.body);
  });
});
