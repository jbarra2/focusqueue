"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type TransitionStartFunction,
} from "react";
import { findGroup, firstFreeColor } from "@/lib/group";
import { DIFFICULTIES, DIFFICULTY_LABEL, type Group } from "@/lib/task";
import type { AddTaskResult } from "@/lib/task-actions";
import { GROUP_LIMIT_MESSAGE } from "@/lib/task-schema";
import { addTaskAction } from "./actions";
import { ColorGrid, colorName } from "./color-grid";

// Said when no answer came back from the action: it could not be reached, Next refused it before
// it ran, or the answer was lost. The task may or may not have been saved, so it does not say
// that nothing was, and it points at the list, so the person does not add it a second time.
const SEND_FAILED_MESSAGE =
  "The app did not answer, so the task may not have been saved. Look at the list, and try again if it is missing.";

type FormProps = {
  groups: Group[];
  today: string;
  /** Whether the form is being sent. The dialog owns this, so it can refuse to close meanwhile. */
  pending: boolean;
  startTransition: TransitionStartFunction;
  onCancel: () => void;
  onAdded: (id: string) => void;
};

// The fields are controlled, and the form is sent from its submit handler, not from a form action.
// React clears the fields of a form action after it runs, even a refused one, which would wipe
// what the person typed. Here a refusal keeps everything and shows its sentence.
function AddTaskForm({ groups, today, pending, startTransition, onCancel, onAdded }: FormProps) {
  const ids = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState(today);
  const [difficulty, setDifficulty] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // The form is mounted each time the dialog opens, and the first field takes the focus.
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // The color follows from the group that is typed, with no state of its own to get out of step:
  // no group has no color, a group that exists keeps its own, and a new group picks one.
  const typedGroup = group.trim();
  const existing = typedGroup === "" ? undefined : findGroup(groups, typedGroup);
  const isNew = typedGroup !== "" && existing === undefined;
  const takenColors = new Set(groups.map((g) => g.color));
  const firstFree = firstFreeColor(takenColors);
  // A color the person picked that has been taken since is not kept, the first free one is used.
  const chosenColor = picked !== null && !takenColors.has(picked) ? picked : firstFree;
  const limitReached = isNew && firstFree === null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setMessage(null);
    startTransition(async () => {
      let result: AddTaskResult;
      try {
        result = await addTaskAction(data);
      } catch {
        setMessage(SEND_FAILED_MESSAGE);
        return;
      }
      if (result.ok) onAdded(result.id);
      else setMessage(result.message);
    });
  }

  return (
    <form className="add-form" onSubmit={onSubmit}>
      <div className="form-field">
        <label htmlFor={`${ids}-name`}>Name</label>
        <input
          ref={nameRef}
          id={`${ids}-name`}
          name="name"
          type="text"
          required
          maxLength={200}
          autoComplete="off"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="form-field">
        <label htmlFor={`${ids}-group`}>Group (optional)</label>
        <input
          id={`${ids}-group`}
          name="group"
          type="text"
          list={`${ids}-groups`}
          maxLength={100}
          autoComplete="off"
          value={group}
          onChange={(event) => setGroup(event.target.value)}
        />
        <datalist id={`${ids}-groups`}>
          {groups.map((g) => (
            <option key={g.name} value={g.name} />
          ))}
        </datalist>
      </div>

      {existing && (
        <p className="form-note">
          Group color:{" "}
          <span className="swatch-chip" data-slot={existing.color}>
            {colorName(existing.color)}
          </span>
        </p>
      )}
      {isNew && !limitReached && (
        <ColorGrid groups={groups} value={chosenColor} onChange={setPicked} />
      )}
      {limitReached && (
        <p className="form-error" role="status">
          {GROUP_LIMIT_MESSAGE}
        </p>
      )}

      <div className="form-field">
        <label htmlFor={`${ids}-due`}>Due date</label>
        <input
          id={`${ids}-due`}
          name="dueDate"
          type="date"
          required
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </div>

      <fieldset className="form-field">
        <legend>Difficulty</legend>
        <div className="choices">
          {DIFFICULTIES.map((value) => (
            <label key={value} className="choice">
              <input
                type="radio"
                name="difficulty"
                value={value}
                required
                checked={difficulty === value}
                onChange={() => setDifficulty(value)}
              />
              {DIFFICULTY_LABEL[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="form-field">
        <label htmlFor={`${ids}-description`}>Description (optional)</label>
        <textarea
          id={`${ids}-description`}
          name="description"
          rows={3}
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}

      <div className="form-actions">
        {/* Not while sending: closing would drop a refusal that is still on its way. */}
        <button type="button" disabled={pending} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={pending || limitReached}>
          {pending ? "Adding..." : "Add"}
        </button>
      </div>
    </form>
  );
}

type Props = {
  /** Every group in use, for the suggestions and for the colors that are taken. */
  groups: Group[];
  /** Today as YYYY-MM-DD, the due date a new task starts with. */
  today: string;
  /** Called once with the id of the task that was added, after the dialog has closed. */
  onAdded: (id: string) => void;
};

/** The Add a task button and its dialog. */
export function AddTask({ groups, today, onAdded }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function show() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    setOpen(true);
    dialog.showModal();
  }

  function close() {
    dialogRef.current?.close();
    setOpen(false);
  }

  return (
    <>
      <button type="button" className="add-task" aria-haspopup="dialog" onClick={show}>
        Add a task
      </button>
      {/* Escape closes a modal dialog by itself, and then says so with a close event. While the
          form is being sent the cancel that comes first is stopped, so a refusal is not lost. */}
      <dialog
        ref={dialogRef}
        className="add-dialog"
        aria-labelledby={titleId}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        onClose={() => setOpen(false)}
      >
        <h2 id={titleId}>Add a task</h2>
        {open && (
          <AddTaskForm
            groups={groups}
            today={today}
            pending={pending}
            startTransition={startTransition}
            onCancel={close}
            onAdded={(id) => {
              close();
              onAdded(id);
            }}
          />
        )}
      </dialog>
    </>
  );
}
