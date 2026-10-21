"use client";

import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import type { ClearResult } from "@/lib/task-actions";
import { clearOldCompletedAction } from "./actions";
import { ErrorLine } from "./error-line";

// Said when no answer came back from the action: it could not be reached, Next refused it before it
// ran, or the answer was lost. Some tasks may or may not have been cleared, so it does not say that
// none were, and it points at the count. One sentence, like every other failure.
const SEND_FAILED_MESSAGE =
  "The app did not answer, so look at the count to see whether the old completed tasks were cleared, and try again if they were not.";

type Props = {
  /** How many tasks were completed before this week, counted by the page with isOldCompleted. */
  count: number;
};

/**
 * The Clear old completed button on the Completed screen. Completed shows this week's tasks, so
 * the older ones show nowhere and pile up until they are cleared. It deletes them all, whatever
 * filter is on, and says how many first. It asks before it deletes, because that cannot be undone.
 * With nothing to clear it stays in place, inactive, so the keyboard focus is not lost.
 */
export function ClearOldCompleted({ count }: Props) {
  const questionId = useId();
  const [asking, setAsking] = useState(false);
  // The count the question was asked with. The page may draw again, with a new count, while the
  // answer is on its way, and the question should not change under the person's hand.
  const [asked, setAsked] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const opener = useRef<HTMLButtonElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const question = useRef<HTMLDivElement>(null);
  // Set by the handlers that swap the button for the question and back, which take the keyboard
  // focus with them. It is not set on the first draw, so nothing takes focus by being drawn.
  const refocus = useRef(false);

  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    // The safe answer has the focus, because the other one deletes.
    (asking ? keep : opener).current?.focus();
  }, [asking]);

  // The question is about the count it was asked with. If the page is drawn again with another
  // count while nothing is on its way, for example when the week turns at midnight and more tasks
  // are old, it no longer says what Yes would do, so it is closed and has to be asked again. The
  // keyboard focus goes back to the button only if it was in the question. While a request is on its
  // way the question is left alone, because the new count may be the answer to it.
  useEffect(() => {
    if (!asking || pending || count === asked) return;
    if (question.current?.contains(document.activeElement)) refocus.current = true;
    setAsking(false);
  }, [asking, pending, count, asked]);

  const nothing = count === 0;

  function ask() {
    // Inactive, not disabled, so it can still be reached and read. It does nothing.
    if (nothing) return;
    setMessage(null);
    setAsked(count);
    refocus.current = true;
    setAsking(true);
  }

  function cancel() {
    if (pending) return;
    // A refusal belongs to the attempt that was just given up, so it goes with it.
    setMessage(null);
    refocus.current = true;
    setAsking(false);
  }

  function confirm() {
    if (pending) return;
    setMessage(null);
    startTransition(async () => {
      let result: ClearResult;
      try {
        result = await clearOldCompletedAction();
      } catch {
        setMessage(SEND_FAILED_MESSAGE);
        return;
      }
      if (result.ok) {
        // The page is drawn again with the count at 0, and the button back as the inactive one.
        refocus.current = true;
        setAsking(false);
      } else {
        setMessage(result.message);
      }
    });
  }

  function onQuestionKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      cancel();
    }
  }

  return (
    <div className="clear-old">
      {asking ? (
        // Escape closes the question from either button, so the one handler is on the group. The
        // group itself takes no focus and is not operated, only its two buttons are.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          ref={question}
          className="clear-old-question"
          role="group"
          aria-labelledby={questionId}
          onKeyDown={onQuestionKeyDown}
        >
          <p id={questionId}>
            Clear {asked} old completed {asked === 1 ? "task" : "tasks"}?
          </p>
          <button
            type="button"
            className="button-primary"
            aria-disabled={pending || undefined}
            onClick={confirm}
          >
            {pending ? "Clearing..." : "Yes, clear"}
          </button>
          {/* Not while sending, so a refusal is not lost. aria-disabled, so focus stays on it. */}
          <button type="button" ref={keep} aria-disabled={pending || undefined} onClick={cancel}>
            Keep them
          </button>
        </div>
      ) : (
        <>
          <button type="button" ref={opener} aria-disabled={nothing || undefined} onClick={ask}>
            Clear old completed
          </button>
          <p className="clear-old-note">
            {nothing ? "Nothing from before this week." : `${count} completed before this week.`}
          </p>
        </>
      )}
      {message && <ErrorLine message={message} />}
    </div>
  );
}
