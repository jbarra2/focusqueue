import { dueLabel, isOverdue } from "@/lib/format";
import type { Task } from "@/lib/task";

type Props = {
  task: Task;
  /** The group's color slot, or undefined for the base card colors. */
  slot: number | undefined;
  today: string;
  isDoNow: boolean;
  /** Whether Tab reaches this card. Only the nearest card on each side does. */
  tabbable: boolean;
  /** Called with the task's id when the card is clicked. */
  onSelect: (id: string) => void;
};

/** A card in the stack that does not have the focus. Clicking it gives it the focus. */
export function StackedCard({ task, slot, today, isDoNow, tabbable, onSelect }: Props) {
  return (
    <button
      type="button"
      className="card stacked-card"
      // Only the edge of an upcoming card shows, so its name is also a tooltip.
      title={task.name}
      data-slot={slot}
      // One Tab stop on each side, the nearest card. The arrow keys, Home, End and
      // the wheel reach the rest, so Tab does not have to walk past every card.
      tabIndex={tabbable ? undefined : -1}
      onClick={() => onSelect(task.id)}
    >
      {isDoNow && <span className="badge">Do now</span>}
      {task.completedAt !== null && <span className="badge badge-done">Done</span>}
      <span className="task-name">{task.name}</span>
      {task.group !== null && <span>{task.group}</span>}
      <span className={isOverdue(task, today) ? "overdue" : undefined}>
        {dueLabel(task, today)}
      </span>
    </button>
  );
}
