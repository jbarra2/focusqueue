import type { RefObject } from "react";
import type { Task } from "@/lib/task";

type Props = {
  task: Task;
  /** The group's color slot, or undefined for the base card colors. */
  slot: number | undefined;
  isDoNow: boolean;
  /** Whether the name is too long to fit, so the card scrolls and keyboard users need to reach it. */
  scrolls: boolean;
  /** The card's element, so the stack can move keyboard focus to it. */
  cardRef: RefObject<HTMLElement | null>;
};

/** The focus card: the name of the task that has the focus. */
export function NameCard({ task, slot, isDoNow, scrolls, cardRef }: Props) {
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
      <h2 id="focus-title" className="task-name">
        {task.name}
      </h2>
    </article>
  );
}
