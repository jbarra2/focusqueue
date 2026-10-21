import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type RefObject,
  type TransitionStartFunction,
} from "react";

type Ask = {
  /** Whether the question is showing, in place of the button that asks it. */
  asking: boolean;
  /** Whether the request that the answer starts is on its way. */
  pending: boolean;
  /** Wraps the request, so `pending` is true until it is done. */
  startTransition: TransitionStartFunction;
  /** The button that asks. It gets the keyboard focus back when the question closes. */
  opener: RefObject<HTMLButtonElement | null>;
  /**
   * The button of the question that takes the focus when it opens. The safe answer when the other
   * one deletes, as in Clear old completed, and the main answer when nothing is lost, as in Mark done.
   */
  answer: RefObject<HTMLButtonElement | null>;
  /** Shows the question, and moves the focus to the answer. */
  ask: () => void;
  /** Gives the question up. It does nothing while a request is on its way. */
  cancel: () => void;
  /**
   * Closes the question: a request worked, or the question no longer says what its answer would do.
   * `withFocus` says whether the focus goes back to the opener, which is wrong when it was somewhere
   * else. The focus only moves when the question opens or closes, so closing one that is already
   * closed arms nothing that matters.
   */
  close: (withFocus?: boolean) => void;
  /** Escape cancels, from either button. Put it on the group that holds the question. */
  onKeyDown: (event: KeyboardEvent) => void;
};

/**
 * What the buttons that ask before they act have in common: Mark done and Clear old completed. A
 * button turns into a question with two answers, and the keyboard focus goes with it, to
 * `answer` when it opens and back to `opener` when it closes. `onCancel` runs when the question is
 * given up, for what belongs to that attempt, such as a refusal that is still showing.
 *
 * The focus only moves when one of the functions here asked for it. It is never moved by the card
 * or the control being drawn, so nothing takes the focus by appearing, in StrictMode too.
 */
export function useAsk(onCancel?: () => void): Ask {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const opener = useRef<HTMLButtonElement>(null);
  const answer = useRef<HTMLButtonElement>(null);
  // Set by the functions that swap the button for the question and back, which take the keyboard
  // focus with them. It is not set on the first draw.
  const refocus = useRef(false);

  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    (asking ? answer : opener).current?.focus();
  }, [asking]);

  function ask() {
    refocus.current = true;
    setAsking(true);
  }

  function close(withFocus = true) {
    refocus.current = withFocus;
    setAsking(false);
  }

  function cancel() {
    if (pending) return;
    onCancel?.();
    close();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      cancel();
    }
  }

  return { asking, pending, startTransition, opener, answer, ask, cancel, close, onKeyDown };
}
