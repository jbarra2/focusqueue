import { completedLabel, dueLabel } from "@/lib/format";
import type { Task } from "@/lib/task";

const DIFFICULTY_LABEL = { low: "Low", med: "Medium", high: "High" } as const;

// Task text is rendered as plain text. React escapes it.
export function TaskItem({ task, today }: { task: Task; today: string }) {
  const overdue = task.completedAt === null && task.dueDate < today;
  return (
    <>
      <p className="task-name">{task.name}</p>
      <p className="task-meta">
        {task.group !== null && <span>{task.group}</span>}
        {task.completedAt === null ? (
          <span className={overdue ? "overdue" : undefined}>{dueLabel(task.dueDate, today)}</span>
        ) : (
          <span>Done {completedLabel(task.completedAt)}</span>
        )}
        <span>{DIFFICULTY_LABEL[task.difficulty]} difficulty</span>
      </p>
      {task.description !== "" && <p className="task-description">{task.description}</p>}
    </>
  );
}
