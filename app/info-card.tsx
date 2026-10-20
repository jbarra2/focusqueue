import { useRef } from "react";
import { completedLabel, dueLabel, isOverdue } from "@/lib/format";
import { DIFFICULTY_LABEL, type Task } from "@/lib/task";
import { useOverflows } from "./use-measure";

type Props = {
  task: Task;
  /** The group's color slot, or undefined for the base card colors. */
  slot: number | undefined;
  today: string;
};

/** The details of the task that has the focus. One card whose content follows the focus. */
export function InfoCard({ task, slot, today }: Props) {
  const descriptionRef = useRef<HTMLDivElement>(null);
  // A long description scrolls inside its own box. The box is a tab stop only when it scrolls.
  // It is measured again when the text changes, not only when the task does.
  const descriptionScrolls = useOverflows(descriptionRef, `${task.id}\n${task.description}`);

  return (
    <aside className="card info-card" data-slot={slot} aria-labelledby="info-title">
      <h2 id="info-title">Details</h2>
      <p className="task-name">{task.name}</p>
      <dl>
        <dt>Group</dt>
        {/* Cut to two lines so a long name cannot push the description box out of the card.
            The full name is the tooltip, and is on the stacked cards. */}
        <dd className="info-group" title={task.group ?? undefined}>
          {task.group ?? "No group"}
        </dd>
        <dt>Due</dt>
        <dd className={isOverdue(task, today) ? "overdue" : undefined}>{dueLabel(task, today)}</dd>
        {task.completedAt !== null && (
          <>
            <dt>Completed</dt>
            <dd>{completedLabel(task.completedAt)}</dd>
          </>
        )}
        <dt>Difficulty</dt>
        <dd>{DIFFICULTY_LABEL[task.difficulty]}</dd>
        <dt id="info-description-label">Description</dt>
        <dd>
          <div
            ref={descriptionRef}
            className="info-description task-description"
            role={descriptionScrolls ? "region" : undefined}
            aria-labelledby={descriptionScrolls ? "info-description-label" : undefined}
            tabIndex={descriptionScrolls ? 0 : undefined}
          >
            {task.description === "" ? "No description" : task.description}
          </div>
        </dd>
      </dl>
    </aside>
  );
}
