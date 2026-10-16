import type { Queue } from "@/lib/sort";
import type { Task } from "@/lib/task";
import { TaskItem } from "./task-item";

function TaskSection({
  id,
  title,
  empty,
  tasks,
  today,
}: {
  id: string;
  title: string;
  empty: string;
  tasks: Task[];
  today: string;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {tasks.length === 0 ? (
        <p className="empty">{empty}</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskItem task={task} today={today} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function QueueView({ queue, today }: { queue: Queue; today: string }) {
  return (
    <>
      <section aria-labelledby="focus-heading" className="focus-card">
        <h2 id="focus-heading">Do now</h2>
        {queue.doNow ? (
          <TaskItem task={queue.doNow} today={today} />
        ) : (
          <p className="empty">The week is clear.</p>
        )}
      </section>
      {/* The add form goes here. */}
      <TaskSection
        id="due-soon-heading"
        title="Due soon"
        empty="Nothing due soon."
        tasks={queue.dueSoon}
        today={today}
      />
      <TaskSection
        id="rest-of-week-heading"
        title="Rest of this week"
        empty="Nothing else due this week."
        tasks={queue.restOfWeek}
        today={today}
      />
      <TaskSection
        id="later-heading"
        title="Later"
        empty="Nothing due after this week."
        tasks={queue.later}
        today={today}
      />
      <TaskSection
        id="done-heading"
        title="Done"
        empty="Nothing done yet this week."
        tasks={queue.done}
        today={today}
      />
    </>
  );
}
