import {
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
  type TransitionStartFunction,
} from "react";
import type { Group } from "@/lib/task";
import { ErrorLine } from "./error-line";
import { TaskFields, useTaskFields, type TaskFieldValues } from "./task-fields";

/**
 * The state of a dialog that holds a task form: `showing` says whether the form is in the page, and
 * `pending` whether it is sending. `showing` is set before the dialog is shown and cleared when it
 * closes, so the form is new each time. It is not the `open` property of the dialog element.
 */
export function useTaskDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [showing, setShowing] = useState(false);
  const [pending, startTransition] = useTransition();

  function show() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    setShowing(true);
    dialog.showModal();
  }

  function close() {
    dialogRef.current?.close();
    setShowing(false);
  }

  // Escape closes a modal dialog by itself, and then says so with a close event. While the form is
  // being sent the cancel that comes first is stopped, so a refusal is not lost. The close event
  // comes a moment after the dialog was closed, so one that arrives after it was shown again is
  // stale, and must not take the form away from the dialog that is open.
  const dialogProps = {
    ref: dialogRef,
    "aria-labelledby": titleId,
    onCancel: (event: SyntheticEvent<HTMLDialogElement>) => {
      if (pending) event.preventDefault();
    },
    onClose: (event: SyntheticEvent<HTMLDialogElement>) => {
      if (!event.currentTarget.open) setShowing(false);
    },
  };

  return { titleId, showing, pending, startTransition, show, close, dialogProps };
}

export type TaskDialogState = ReturnType<typeof useTaskDialog>;

type DialogProps = {
  dialog: TaskDialogState;
  title: string;
  /** The form. It is only in the page while the dialog is showing, so it starts fresh each time. */
  children: ReactNode;
};

/** A modal dialog with a heading, for a task form. */
export function TaskDialog({ dialog, title, children }: DialogProps) {
  return (
    <dialog className="add-dialog" {...dialog.dialogProps}>
      <h2 id={dialog.titleId}>{title}</h2>
      {dialog.showing && children}
    </dialog>
  );
}

// What a form is sent to, and what comes back: the id of the task that was saved, or a sentence for
// the person. Any action that saves a task answers in this shape, and it may add to it.
type SaveResult = { ok: true; id: string } | { ok: false; message: string };
type FormProps = {
  groups: Group[];
  initial: TaskFieldValues;
  /** Whether the form is being sent. The dialog owns this, so it can refuse to close meanwhile. */
  pending: boolean;
  startTransition: TransitionStartFunction;
  /** Sends the fields to the server, and gives back its answer. */
  send: (data: FormData) => Promise<SaveResult>;
  /** Called with the task's id when it was saved. */
  onSaved: (id: string) => void;
  onCancel: () => void;
  submitLabel: string;
  pendingLabel: string;
  /** Said when no answer came back from the action: it could not be reached, Next refused it, or the answer was lost. */
  noAnswerMessage: string;
  /**
   * Whether the button stays off while every group color is taken and a new group is typed. Add
   * needs that, since a new task cannot take a color that is not free. Edit does not, since the
   * task may be the last one in its group, and then its color is free again. The form cannot know,
   * so the server decides, and answers with a sentence when it is not.
   */
  limitBlocks?: boolean;
  /** Said at that limit, in place of the sentence that Add uses. */
  limitMessage?: string;
};

// The fields are controlled, and the form is sent from its submit handler, not from a form action.
// React clears the fields of a form action after it runs, even a refused one, which would wipe
// what the person typed. Here a refusal keeps everything and shows its sentence.
export function TaskForm({
  groups,
  initial,
  pending,
  startTransition,
  send,
  onSaved,
  onCancel,
  submitLabel,
  pendingLabel,
  noAnswerMessage,
  limitBlocks = true,
  limitMessage,
}: FormProps) {
  const fields = useTaskFields(initial, groups);
  const [message, setMessage] = useState<string | null>(null);

  // Holding Enter on the button that opened the dialog repeats the key, and the repeats arrive at the
  // first field by then, where Enter sends the form. A repeat is the same press, not a second
  // decision, so it sends nothing. A separate press still does, and so does Enter in the description,
  // where it is a new line.
  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && event.repeat && !(event.target instanceof HTMLTextAreaElement)) {
      event.preventDefault();
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setMessage(null);
    startTransition(async () => {
      let result: SaveResult;
      try {
        result = await send(data);
      } catch {
        setMessage(noAnswerMessage);
        return;
      }
      if (result.ok) onSaved(result.id);
      else setMessage(result.message);
    });
  }

  return (
    // The one handler is on the form, which is not operated itself, only its fields and buttons are.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <form className="add-form" onSubmit={onSubmit} onKeyDown={onKeyDown}>
      {/* The fields scroll when the window is shorter than the form. The footer under them, with
          the refusal and the buttons, does not, so a refusal is always in view. */}
      <div className="form-body">
        <TaskFields fields={fields} limitMessage={limitMessage} />
      </div>

      <div className="form-footer">
        {message && <ErrorLine message={message} />}

        <div className="form-actions">
          {/* Not while sending: closing would drop a refusal that is still on its way. */}
          <button type="button" disabled={pending} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="button-primary"
            disabled={pending || (limitBlocks && fields.limitReached)}
          >
            {pending ? pendingLabel : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
