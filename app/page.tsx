import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { localDay } from "@/lib/date";
import { filterHref, parseSearchParams, stackView, type RawSearchParams } from "@/lib/filter";
import { buildQueue, isOldCompleted } from "@/lib/sort";
import { listGroups, listTasks } from "@/lib/tasks";
import { CardStack } from "./card-stack";
import { ClearOldCompleted } from "./clear-old-completed";
import { DayRefresh } from "./day-refresh";
import { StackFilters } from "./stack-filters";

// The prop is typed here, not with the generated PageProps type, which does not exist until a
// build or dev run has made it, and typecheck runs before that in CI.
export default async function Home({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  // better-sqlite3 is synchronous, so without this the page would be built once at `next build`.
  await connection();
  const today = localDay(new Date().toISOString());
  const db = getDb();
  const tasks = listTasks(db);
  const queue = buildQueue(tasks, today);
  const groups = listGroups(db);
  // Anything in the URL that is not valid falls back to its default, so this never fails.
  const { filters, focusTaskId } = parseSearchParams(await searchParams, groups);
  const view = stackView(queue, filters);
  // The tasks from before this week, which no view shows, for Clear old completed on the Completed
  // screen. The same rule picks the ones that are deleted, so this is the number that goes.
  const oldCompleted =
    filters.view === "completed" ? tasks.filter((task) => isOldCompleted(task, today)).length : 0;
  return (
    // The header is outside main, so it is the page's banner. The layout wraps both in the
    // full-height column.
    <>
      <header className="page-header">
        <h1>Focusqueue</h1>
        <StackFilters filters={filters} groups={groups} today={today} count={view.tasks.length} />
      </header>
      <main>
        <DayRefresh today={today} />
        {filters.view === "completed" && <ClearOldCompleted count={oldCompleted} />}
        <CardStack
          // A new key starts the stack fresh, on the first card, whenever the filters change.
          key={filterHref(filters, focusTaskId)}
          {...view}
          groups={groups}
          today={today}
          focusTaskId={focusTaskId}
        />
      </main>
    </>
  );
}
