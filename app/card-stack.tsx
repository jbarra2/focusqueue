"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { slotLookup } from "@/lib/group";
import { focusAfter, indexOfTask, STACK_REACH, type Move } from "@/lib/stack";
import type { Group, Task } from "@/lib/task";
import { InfoCard } from "./info-card";
import { NameCard } from "./name-card";
import { StackedCard } from "./stacked-card";
import { useOverflows } from "./use-measure";
import { useStackInput } from "./use-stack-input";

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

  // The group names are folded once for the list, not once for every card on every render.
  const slotOf = useMemo(() => slotLookup(groups), [groups]);

  const stackRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLElement>(null);
  const userMoved = useRef(false);
  // A very long name scrolls inside the focus card, which is then a tab stop. It is measured here
  // and not in NameCard, which is a new element on every move and would start out unmeasured.
  // It is measured again when the name changes, not only when the task does.
  const shown = tasks[index];
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

  const hasStack = count > 0;
  useStackInput({ stackRef, tasksRef, lastIndex, go, hasStack });

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

  const lookup = (task: Task) => slotOf(task.group) ?? undefined;
  const focused = tasks[index];

  return (
    <div className="stack" ref={stackRef}>
      {notice && <p className="empty">{notice}</p>}
      <div className="stage">
        <InfoCard task={focused} slot={lookup(focused)} today={today} />
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
                  <NameCard
                    task={task}
                    slot={lookup(task)}
                    isDoNow={isDoNow}
                    scrolls={nameScrolls}
                    cardRef={focusRef}
                  />
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
                <StackedCard
                  task={task}
                  slot={lookup(task)}
                  today={today}
                  isDoNow={isDoNow}
                  tabbable={distance === 1}
                  onSelect={(id) => go({ id })}
                />
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
