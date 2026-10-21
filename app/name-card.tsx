import type { KeyboardEvent, RefObject } from "react";
import type { MarkResult } from "@/lib/task-actions";
import type { Task } from "@/lib/task";
import { markDoneAction, markOpenAction } from "./actions";
import { Question } from "./question";
import { useAsk } from "./use-ask";

// Said when no answer came back from the action: it could not be reached, Next refused it before it
// ran, or the answer was lost. The task may or may not have been changed, so it does not say that
// nothing was, and it points at the list. One sentence, like every other failure.
const SEND_FAILED_MESSAGE =
  "The app did not answer, so look at the list to see whether the task changed, and try again if it did not.";

/** What the stack shows above the cards for a request that did not work out. */
export type CardMessage = { text: string; gone: boolean };

type Props = {
  task: Task;
  /** The group's color slot, or undefined for the base card colors. */
  slot: number | undefined;
  isDoNow: boolean;
  /** Whether the name is too long to fit, so the card scrolls and keyboard users need to reach it. */
  scrolls: boolean;
  /** The card's element, so the stack can move keyboard focus to it. */
  cardRef: RefObject<HTMLElement | null>;
  /**
   * Called with this task's id when a request is about to be sent, and with null if it did not work
   * out. The stack uses it to know, when the task leaves the list, that the keyboard focus was on a
   * button of this card, which leaves with it, so that the card that takes its place gets it.
   */
  onSend: (id: string | null) => void;
  /** Called with a sentence to show above the cards, or with null to take it away. */
  onMessage: (message: CardMessage | null) => void;
};

/**
 * The focus card: the name of the task that has the focus, and the button that changes it. An open
 * task has Mark done, which asks first. A done task, which is only shown on Completed, has Mark
 * open, which does not ask, because nothing is lost by it. The card is a new element each time the
 * focus moves to it, so the question is never left open on a card that was moved away from.
 */
export function NameCard({ task, slot, isDoNow, scrolls, cardRef, onSend, onMessage }: Props) {
  const done = task.completedAt !== null;
  // A refusal belongs to the attempt that was just given up, so it goes with it. The focus goes to
  // Yes, done when the question opens, and back to Mark done when it closes.
  const {
    asking,
    pending,
    startTransition,
    opener,
    answer: yes,
    ask,
    cancel,
    onKeyDown,
  } = useAsk(() => onMessage(null));

  function send() {
    if (pending) return;
    onMessage(null);
    // Before the request, so it does not matter whether the answer or the new page arrives first.
    onSend(task.id);
    startTransition(async () => {
      let result: MarkResult;
      try {
        result = await (done ? markOpenAction : markDoneAction)(task.id);
      } catch {
        onSend(null);
        onMessage({ text: SEND_FAILED_MESSAGE, gone: false });
        return;
      }
      // When it worked, or the task was gone, the page is drawn again with the task out of the list,
      // and this card goes with it. Nothing is left to do here.
      if (result.ok) return;
      if (!result.gone) onSend(null);
      onMessage({ text: result.message, gone: result.gone === true });
    });
  }

  // Holding Enter on Mark done repeats the key, and the repeats arrive at whatever has the focus by
  // then, which is Yes, done. A repeat is the same press, not a second decision, so it does not
  // answer the question. Two separate presses still do.
  function onYesKeyDown(event: KeyboardEvent) {
    if (event.repeat) event.preventDefault();
  }

  return (
    <article
      className="card name-card"
      data-slot={slot}
      aria-labelledby="focus-title"
      // Only for programmatic focus, unless a very long name scrolls in the card,
      // which keyboard users then need to reach.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={scrolls ? 0 : -1}
      ref={cardRef}
    >
      {isDoNow && <p className="badge">Do now</p>}
      {/* A completed task is never Do now, so only one of the two is ever here. */}
      {task.completedAt !== null && <p className="badge badge-done">Done</p>}
      <h2 id="focus-title" className="task-name">
        {task.name}
      </h2>
      <div className="card-actions">
        {done ? (
          <button type="button" aria-disabled={pending || undefined} onClick={send}>
            {pending ? "Saving..." : "Mark open"}
          </button>
        ) : asking ? (
          <Question className="card-question" label="Mark done?" onKeyDown={onKeyDown}>
            <div className="card-buttons">
              <button
                type="button"
                ref={yes}
                className="button-primary"
                aria-disabled={pending || undefined}
                onClick={send}
                onKeyDown={onYesKeyDown}
              >
                {pending ? "Saving..." : "Yes, done"}
              </button>
              {/* Not while sending, as in the Add dialog: the person would not see how it ended.
                  aria-disabled, not disabled, so the keyboard focus is not lost when it applies. */}
              <button type="button" aria-disabled={pending || undefined} onClick={cancel}>
                Not yet
              </button>
            </div>
          </Question>
        ) : (
          <button type="button" ref={opener} onClick={ask}>
            Mark done
          </button>
        )}
      </div>
    </article>
  );
}
