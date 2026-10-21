"use client";

import type { Group } from "@/lib/task";
import { addTaskAction } from "./actions";
import { TaskDialog, TaskForm, useTaskDialog } from "./task-dialog";

// Said when no answer came back from the action: it could not be reached, Next refused it before
// it ran, or the answer was lost. The task may or may not have been saved, so it does not say
// that nothing was, and it points at the list, so the person does not add it a second time. One
// sentence, like every other failure.
const SEND_FAILED_MESSAGE =
  "The app did not answer, so look at the list to see whether the task was saved, and try again if it was not.";

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
  const dialog = useTaskDialog();

  return (
    <>
      <button
        type="button"
        className="add-task button-primary"
        aria-haspopup="dialog"
        onClick={dialog.show}
      >
        Add a task
      </button>
      <TaskDialog dialog={dialog} title="Add a task">
        <TaskForm
          groups={groups}
          initial={{ name: "", group: "", dueDate: today, difficulty: "", description: "" }}
          pending={dialog.pending}
          startTransition={dialog.startTransition}
          send={addTaskAction}
          onSaved={(id) => {
            dialog.close();
            onAdded(id);
          }}
          onCancel={dialog.close}
          submitLabel="Add"
          pendingLabel="Adding..."
          noAnswerMessage={SEND_FAILED_MESSAGE}
        />
      </TaskDialog>
    </>
  );
}
