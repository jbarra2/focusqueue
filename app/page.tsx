import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { localDay } from "@/lib/date";
import { buildQueue, upNext } from "@/lib/sort";
import { listGroups, listTasks } from "@/lib/tasks";
import { CardStack } from "./card-stack";

export default async function Home() {
  // better-sqlite3 is synchronous, so without this the page would be built once at `next build`.
  await connection();
  const today = localDay(new Date().toISOString());
  const db = getDb();
  const queue = buildQueue(listTasks(db), today);
  return (
    <main>
      <header>
        <h1>Focusqueue</h1>
      </header>
      <CardStack
        tasks={upNext(queue)}
        groups={listGroups(db)}
        today={today}
        doNowId={queue.doNow?.id ?? null}
      />
    </main>
  );
}
