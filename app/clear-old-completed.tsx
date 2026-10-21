"use client";

import { useEffect, useRef, useState } from "react";
import type { ClearResult } from "@/lib/task-actions";
import { clearOldCompletedAction } from "./actions";
import { ErrorLine } from "./error-line";
import { Question } from "./question";
import { useAsk } from "./use-ask";

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
  const [message, setMessage] = useState<string | null>(null);
  // A refusal belongs to the attempt that was just given up, so it goes with it. The focus goes to
  // Keep them when the question opens, because the other answer deletes, and back to the button when
  // it closes.
  const {
    asking,
    pending,
    startTransition,
    opener,
    answer: keep,
    ask: openQuestion,
    cancel,
    close,
    onKeyDown,
  } = useAsk(() => setMessage(null));
  // The count the question was asked with. The page may draw again, with a new count, while the
  // answer is on its way, and the question should not change under the person's hand.
  const [asked, setAsked] = useState(0);
  const question = useRef<HTMLDivElement>(null);

  // The question is about the count it was asked with. If the page is drawn again with another
  // count while nothing is on its way, for example when the week turns at midnight and more tasks
  // are old, it no longer says what Yes would do, so it is closed and has to be asked again. The
  // keyboard focus goes back to the button only if it was in the question. While a request is on its
  // way the question is left alone, because the new count may be the answer to it.
  useEffect(() => {
    if (!asking || pending || count === asked) return;
    close(question.current?.contains(document.activeElement) ?? false);
  }, [asking, pending, count, asked]);

  const nothing = count === 0;

  function ask() {
    // Inactive, not disabled, so it can still be reached and read. It does nothing.
    if (nothing) return;
    setMessage(null);
    setAsked(count);
    openQuestion();
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
        close();
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="clear-old">
      {asking ? (
        <Question
          ref={question}
          className="clear-old-question"
          label={
            <>
              Clear {asked} old completed {asked === 1 ? "task" : "tasks"}?
            </>
          }
          onKeyDown={onKeyDown}
        >
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
        </Question>
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
