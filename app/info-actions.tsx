import type { Group, Task } from "@/lib/task";
import type { DeleteResult, UpdateTaskResult } from "@/lib/task-actions";
import { GROUP_COLOR_COUNT } from "@/lib/theme";
import { deleteTaskAction, updateTaskAction } from "./actions";
import type { CardMessage } from "./name-card";
import { Question } from "./question";
import { TaskDialog, TaskForm, useTaskDialog } from "./task-dialog";
import { useAsk } from "./use-ask";

// Said when no answer came back from an action: it could not be reached, Next refused it before it
// ran, or the answer was lost. The task may or may not have been changed, so they do not say that it
// was not, and they point at the list. One sentence each, like every other failure.
const SAVE_FAILED_MESSAGE =
  "The app did not answer, so look at the list to see whether the task was saved, and try again if it was not.";
const DELETE_FAILED_MESSAGE =
  "The app did not answer, so look at the list to see whether the task was deleted, and try again if it was not.";

// At the limit, Save stays on, because the task may be the last one in its group, and then its color
// is free again. The server knows, and says so if it is not.
const EDIT_LIMIT_MESSAGE = `All ${GROUP_COLOR_COUNT} group colors are taken, so a new group only works when this is the last task in its group, and otherwise you can choose an existing group, leave the group empty, or delete an old group's tasks to free its color.`;

type Props = {
  task: Task;
  /** Every group in use, for the suggestions and for the colors that are taken. */
  groups: Group[];
  /** As on the focus card: called with this task's id before a request is sent, and with null if it did not work out. */
  onSend: (id: string | null) => void;
  /** Called with a sentence to show above the cards, or with null to take it away. */
  onMessage: (message: CardMessage | null) => void;
};

/**
 * Edit and Delete, under the details of the task that has the focus. Edit opens the same dialog as
 * Add a task, filled in with the task. Delete asks first, with the focus on Keep it, because the
 * other answer cannot be taken back. It is a new element for each task, so an open question or a
 * draft is not left on a card that was moved away from.
 */
export function InfoActions({ task, groups, onSend, onMessage }: Props) {
  const dialog = useTaskDialog();
  // A refusal belongs to the attempt that was just given up, so it goes with it. The focus goes to
  // Keep it when the question opens, and back to Delete when it closes.
  const {
    asking,
    pending,
    startTransition,
    opener,
    answer: keep,
    ask,
    cancel,
    onKeyDown,
  } = useAsk(() => onMessage(null));

  // The dialog shows a refusal itself. A task that was gone goes above the cards as well, because
  // the page is drawn again without it, and the card and the dialog go with it.
  async function save(data: FormData): Promise<UpdateTaskResult> {
    onMessage(null);
    // Before the request, so it does not matter whether the answer or the new page arrives first.
    // The task may leave the view because of what was changed, and then the card in its place takes
    // the keyboard focus, which was in this dialog.
    onSend(task.id);
    let result: UpdateTaskResult;
    try {
      result = await updateTaskAction(task.id, data);
    } catch (error) {
      onSend(null);
      throw error;
    }
    if (!result.ok) {
      if (result.gone) onMessage({ text: result.message, gone: true });
      else onSend(null);
    }
    return result;
  }

  function remove() {
    if (pending) return;
    onMessage(null);
    onSend(task.id);
    startTransition(async () => {
      let result: DeleteResult;
      try {
        result = await deleteTaskAction(task.id);
      } catch {
        onSend(null);
        onMessage({ text: DELETE_FAILED_MESSAGE, gone: false });
        return;
      }
      // When it worked, or the task was gone, the page is drawn again without the task, and this
      // card goes with it. Nothing is left to do here.
      if (result.ok) return;
      if (!result.gone) onSend(null);
      onMessage({ text: result.message, gone: result.gone === true });
    });
  }

  return (
    <>
      <div className="card-actions">
        {asking ? (
          <Question className="card-question" label="Delete this task?" onKeyDown={onKeyDown}>
            <div className="card-buttons">
              <button
                type="button"
                className="button-primary"
                aria-disabled={pending || undefined}
                onClick={remove}
              >
                {pending ? "Deleting..." : "Yes, delete"}
              </button>
              {/* Not while sending, so a refusal is not lost. aria-disabled, so focus stays on it. */}
              <button
                type="button"
                ref={keep}
                aria-disabled={pending || undefined}
                onClick={cancel}
              >
                Keep it
              </button>
            </div>
          </Question>
        ) : (
          <div className="card-buttons">
            <button type="button" aria-haspopup="dialog" onClick={dialog.show}>
              Edit
            </button>
            <button type="button" ref={opener} onClick={ask}>
              Delete
            </button>
          </div>
        )}
      </div>
      <TaskDialog dialog={dialog} title="Edit a task">
        <TaskForm
          groups={groups}
          initial={{
            name: task.name,
            group: task.group ?? "",
            dueDate: task.dueDate,
            difficulty: task.difficulty,
            description: task.description,
          }}
          pending={dialog.pending}
          startTransition={dialog.startTransition}
          send={save}
          onSaved={dialog.close}
          onCancel={dialog.close}
          submitLabel="Save"
          pendingLabel="Saving..."
          noAnswerMessage={SAVE_FAILED_MESSAGE}
          limitBlocks={false}
          limitMessage={EDIT_LIMIT_MESSAGE}
        />
      </TaskDialog>
    </>
  );
}
