import { useEffect, type RefObject } from "react";
import {
  accumulateWheel,
  isEditableTarget,
  isVerticalWheel,
  stepFromKey,
  wheelDelta,
  type Move,
} from "@/lib/stack";
import type { Task } from "@/lib/task";
import { scrollsItself } from "./use-measure";

// After a card change, further wheel input is ignored briefly, so one flick moves one card.
const WHEEL_COOLDOWN_MS = 110;
// Wheel input that stops for this long no longer counts toward the next card.
export const WHEEL_IDLE_MS = 150;

type Input = {
  stackRef: RefObject<HTMLDivElement | null>;
  /** The newest list, so the handlers do not depend on it. The caller keeps it current. */
  tasksRef: RefObject<Task[]>;
  /** Where the focus card was on the last render. The caller keeps it current. */
  lastIndex: RefObject<number>;
  go: (move: Move) => void;
  /**
   * Whether the stack element exists, which is only while there are tasks. It is not read here:
   * a change means `stackRef` now holds another element, so the listeners are attached again.
   */
  hasStack: boolean;
};

/**
 * Arrow keys and the wheel move the stack. The keys are ignored in text fields. The stack exists
 * only while there are tasks, so the listeners are attached again when that changes.
 */
export function useStackInput({ stackRef, tasksRef, lastIndex, go, hasStack }: Input): void {
  useEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;

    let built = 0;
    let lastStep = 0;
    let idle: number | undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      // Something other than an element, such as the document itself, has nothing to check.
      const target = event.target;
      if (!(target instanceof Element)) return;
      // A dialog, such as Add a task, is not part of the stack. Its fields and links keep their
      // own arrow keys, which includes a link, which the exception below would otherwise take.
      if (target.closest("dialog, [data-no-stack]")) return;
      if (
        isEditableTarget(target.tagName, target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const move = stepFromKey(event.key);
      if (move === null) return;
      // Work from the stack itself or from the page body, but not from other controls. The one
      // exception is a link, such as a view in the header: the left and right arrows do nothing
      // there, and a click leaves focus on the link, so they would stop working after it. Home and
      // End still scroll the page from a link.
      const sideways = move === "previous" || move === "next";
      const onLink = target.closest("a") !== null;
      if (target !== document.body && !stack.contains(target) && !(sideways && onLink)) return;
      if (move === "first" || move === "last") {
        // Home and End scroll the page when nothing in the stack has focus, and scroll a box
        // that has focus because it has more text than fits. A focus card that does not scroll
        // leaves them to the stack, or they would stop working after the first move.
        if (target === document.body) return;
        if (scrollsItself(target)) return;
      }
      event.preventDefault();
      go(move);
    };

    const onWheel = (event: WheelEvent) => {
      // Ctrl with the wheel, and a pinch on a trackpad, zoom the page. Leave that alone.
      if (event.ctrlKey || event.metaKey) return;
      // A dialog is not part of the stack, as for the keys above, even when it is inside one of its
      // cards, as Edit is. Its form scrolls itself, and over it the wheel must not step the cards
      // behind it. Nothing is prevented, so the browser scrolls the form.
      if (event.target instanceof Element && event.target.closest("dialog, [data-no-stack]"))
        return;
      // Which way the wheel moves is decided in one place, which wheelDelta uses too.
      const vertical = isVerticalWheel(event.deltaX, event.deltaY);
      // A box with more text than fits scrolls itself, so leave the wheel to it.
      if (vertical && event.target instanceof Element && scrollsItself(event.target)) return;
      // Only a vertical wheel needs to know whether the page scrolls, which forces a layout.
      const pageScrolls = vertical && document.documentElement.scrollHeight > window.innerHeight;
      const delta = wheelDelta(event.deltaX, event.deltaY, event.deltaMode, pageScrolls);
      if (delta === 0) return;
      // At either end the stack cannot move, so the browser keeps the event, for example a
      // sideways swipe that goes back a page.
      const last = tasksRef.current.length - 1;
      if ((delta > 0 && lastIndex.current >= last) || (delta < 0 && lastIndex.current <= 0)) {
        return;
      }
      event.preventDefault();

      const now = performance.now();
      if (now - lastStep < WHEEL_COOLDOWN_MS) return;
      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        built = 0;
      }, WHEEL_IDLE_MS);
      const result = accumulateWheel(built, delta);
      built = result.built;
      if (result.step !== 0) {
        lastStep = now;
        go(result.step === 1 ? "next" : "previous");
      }
    };

    document.addEventListener("keydown", onKeyDown);
    // Not passive, so a sideways scroll over the stack does not also scroll the page.
    stack.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      stack.removeEventListener("wheel", onWheel);
      window.clearTimeout(idle);
    };
  }, [stackRef, tasksRef, lastIndex, go, hasStack]);
}
