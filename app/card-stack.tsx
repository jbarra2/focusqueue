"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { completedLabel, dueLabel, isOverdue } from "@/lib/format";
import { slotFor } from "@/lib/group";
import {
  accumulateWheel,
  focusAfter,
  indexOfTask,
  isEditableTarget,
  STACK_REACH,
  stepFromKey,
  wheelAmount,
  wheelDelta,
  type Move,
} from "@/lib/stack";
import type { Group, Task } from "@/lib/task";

const DIFFICULTY_LABEL = { low: "Low", med: "Medium", high: "High" } as const;

// After a card change, further wheel input is ignored briefly, so one flick moves one card.
const WHEEL_COOLDOWN_MS = 110;
// Wheel input that stops for this long no longer counts toward the next card.
const WHEEL_IDLE_MS = 150;

/**
 * Whether the element has more content than fits, so it scrolls. It is checked again when the
 * element is resized and when `key` changes, which is when its content changes.
 */
function useOverflows(ref: RefObject<HTMLElement | null>, key: unknown): boolean {
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      setOverflows(false);
      return;
    }
    const measure = () => setOverflows(element.scrollHeight > element.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, key]);
  return overflows;
}

/**
 * Whether the target is inside a box that has more text than fits, so the box scrolls itself.
 * The wheel and Home and End are left to such a box.
 */
function scrollsItself(target: Element): boolean {
  const box = target.closest<HTMLElement>(".info-description, .name-card");
  return box !== null && box.scrollHeight > box.clientHeight;
}

type Props = {
  /** The tasks of the current view, in that view's order. */
  tasks: Task[];
  groups: Group[];
  today: string;
  /** The queue's pick, or null when nothing is due this week. */
  doNowId: string | null;
  /** The name of the view, such as "Up next", for the list's label. */
  label: string;
  /** Said instead of the stack when there are no tasks. */
  emptyMessage: string;
  /** A line above the stack, such as that the week is clear. */
  notice?: string;
  /** The task a link asks to start on, if it is in the list. */
  focusTaskId?: string | null;
};

// Task text is rendered as plain text. React escapes it. Colors come from the theme's group
// slots through data-slot, so no task text ever reaches a style.
export function CardStack({
  tasks,
  groups,
  today,
  doNowId,
  label,
  emptyMessage,
  notice,
  focusTaskId = null,
}: Props) {
  const count = tasks.length;
  // The focus follows the task, not its place in the list, so a refreshed list does not move it
  // to another task. If the task is gone (done or deleted), the card now in its place has it.
  // It starts on the task a link asked for, else the Do now task, else the first card, using the
  // first of those that is in the list.
  const [focusId, setFocusId] = useState<string | null>(
    () =>
      [focusTaskId, doNowId].find((id) => tasks.some((task) => task.id === id)) ??
      tasks[0]?.id ??
      null,
  );
  // Where the focus card was on the last render, for when its task is gone.
  const lastIndex = useRef(0);
  const index = indexOfTask(tasks, focusId, lastIndex.current);
  // The newest list, so the keyboard and wheel handlers do not depend on it, and a refreshed
  // list does not tear them down and lose a wheel gesture in progress.
  const tasksRef = useRef(tasks);

  const stackRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const userMoved = useRef(false);
  // A long description scrolls inside its own box. The box is a tab stop only when it scrolls.
  // It is measured again when the text changes, not only when the task does. A very long name
  // scrolls inside the focus card in the same way.
  const shown = tasks[index];
  const descriptionScrolls = useOverflows(
    descriptionRef,
    shown ? `${shown.id}\n${shown.description}` : null,
  );
  const nameScrolls = useOverflows(focusRef, shown ? `${shown.id}\n${shown.name}` : null);

  useEffect(() => {
    tasksRef.current = tasks;
    lastIndex.current = index;
    // If the task is gone, the card now in its place takes the focus for good. Otherwise the old
    // task would take it back if it returned, for example when it is marked open again.
    const here = tasks[index];
    if (here && here.id !== focusId) setFocusId(here.id);
  });

  const go = useCallback((move: Move | number | { id: string }) => {
    setFocusId((from) => {
      const next = focusAfter(tasksRef.current, from, lastIndex.current, move);
      // Only a move that changes the card asks for keyboard focus to follow it. Setting the
      // flag twice, as React may do with an updater, changes nothing.
      if (next !== from) userMoved.current = true;
      return next;
    });
  }, []);

  // Arrow keys and the wheel move the stack. The keys are ignored in text fields. The stack
  // exists only while there are tasks, so the listeners are attached again when that changes.
  const hasStack = count > 0;
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
      // The axis is chosen once, from the raw numbers, and only that axis is counted. In lines
      // or pages every axis with any movement would count as a full step, so choosing again
      // after that could pick the other axis.
      const vertical = Math.abs(event.deltaY) > Math.abs(event.deltaX);
      // A box with more text than fits scrolls itself, so leave the wheel to it.
      if (vertical && event.target instanceof Element && scrollsItself(event.target)) return;
      // Only a vertical wheel needs to know whether the page scrolls, which forces a layout.
      const pageScrolls = vertical && document.documentElement.scrollHeight > window.innerHeight;
      const delta = wheelDelta(
        vertical ? 0 : wheelAmount(event.deltaX, event.deltaMode),
        vertical ? wheelAmount(event.deltaY, event.deltaMode) : 0,
        pageScrolls,
      );
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
  }, [go, hasStack]);

  // A clicked card turns into the focus card, so keyboard focus would be lost, and the browser
  // puts it on the page body. Move it to the new focus card then. If it is anywhere else, for
  // example in a field outside the stack, leave it there.
  useEffect(() => {
    if (!userMoved.current) return;
    userMoved.current = false;
    const active = document.activeElement;
    // A stacked card that has focus slides away as the stack moves, and can end up hidden, so
    // focus moves to the focus card from there too.
    if (!active || active === document.body || active.closest(".stacked-card")) {
      focusRef.current?.focus({ preventScroll: true });
    }
  }, [index]);

  if (count === 0) {
    return <p className="empty">{emptyMessage}</p>;
  }

  const lookup = (task: Task) => slotFor(groups, task.group) ?? undefined;
  const focused = tasks[index];

  return (
    <div className="stack" ref={stackRef}>
      {notice && <p className="empty">{notice}</p>}
      <div className="stage">
        <aside className="card info-card" data-slot={lookup(focused)} aria-labelledby="info-title">
          <h2 id="info-title">Details</h2>
          <p className="task-name">{focused.name}</p>
          <dl>
            <dt>Group</dt>
            {/* Cut to two lines so a long name cannot push the description box out of the card.
                The full name is the tooltip, and is on the stacked cards. */}
            <dd className="info-group" title={focused.group ?? undefined}>
              {focused.group ?? "No group"}
            </dd>
            <dt>Due</dt>
            <dd className={isOverdue(focused, today) ? "overdue" : undefined}>
              {dueLabel(focused, today)}
            </dd>
            {focused.completedAt !== null && (
              <>
                <dt>Completed</dt>
                <dd>{completedLabel(focused.completedAt)}</dd>
              </>
            )}
            <dt>Difficulty</dt>
            <dd>{DIFFICULTY_LABEL[focused.difficulty]}</dd>
            <dt id="info-description-label">Description</dt>
            <dd>
              <div
                ref={descriptionRef}
                className="info-description task-description"
                role={descriptionScrolls ? "region" : undefined}
                aria-labelledby={descriptionScrolls ? "info-description-label" : undefined}
                tabIndex={descriptionScrolls ? 0 : undefined}
              >
                {focused.description === "" ? "No description" : focused.description}
              </div>
            </dd>
          </dl>
        </aside>
        {/* Safari drops the list role when list-style is none, which would lose the label. */}
        {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
        <ol
          className="track"
          role="list"
          aria-label={`${label}, ${count} ${count === 1 ? "task" : "tasks"}`}
        >
          {tasks.map((task, position) => {
            const offset = position - index;
            const distance = Math.abs(offset);
            const style = { "--d": distance } as CSSProperties;
            const isDoNow = task.id === doNowId;

            if (offset === 0) {
              return (
                <li key={task.id} className="slot" data-side="current" style={style}>
                  <article
                    className="card name-card"
                    data-slot={lookup(task)}
                    aria-labelledby="focus-title"
                    // Only for programmatic focus, unless a very long name scrolls in the card,
                    // which keyboard users then need to reach.
                    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                    tabIndex={nameScrolls ? 0 : -1}
                    ref={focusRef}
                  >
                    {isDoNow && <p className="badge">Do now</p>}
                    <h2 id="focus-title" className="task-name">
                      {task.name}
                    </h2>
                  </article>
                </li>
              );
            }
            return (
              <li
                key={task.id}
                className="slot"
                data-side={offset < 0 ? "past" : "upcoming"}
                data-far={distance > STACK_REACH ? "" : undefined}
                style={style}
              >
                <button
                  type="button"
                  className="card stacked-card"
                  // Only the edge of an upcoming card shows, so its name is also a tooltip.
                  title={task.name}
                  data-slot={lookup(task)}
                  // One Tab stop on each side, the nearest card. The arrow keys, Home, End and
                  // the wheel reach the rest, so Tab does not have to walk past every card.
                  tabIndex={distance === 1 ? undefined : -1}
                  onClick={() => go({ id: task.id })}
                >
                  {isDoNow && <span className="badge">Do now</span>}
                  <span className="task-name">{task.name}</span>
                  {task.group !== null && <span>{task.group}</span>}
                  <span className={isOverdue(task, today) ? "overdue" : undefined}>
                    {dueLabel(task, today)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="stack-controls">
        {/* aria-disabled, not disabled, so focus stays on the button at either end. */}
        <button
          type="button"
          onClick={() => go("previous")}
          aria-disabled={index === 0 || undefined}
        >
          Previous
        </button>
        <p className="stack-status" aria-live="polite">
          {index + 1} of {count}
          {/* Not shown, but announced, so a move by button or click says which task it is on. */}
          <span className="visually-hidden">: {focused.name}</span>
        </p>
        <button
          type="button"
          onClick={() => go("next")}
          aria-disabled={index === count - 1 || undefined}
        >
          Next
        </button>
      </div>
    </div>
  );
}
