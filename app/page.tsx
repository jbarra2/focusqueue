import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { buildQueue, localDay } from "@/lib/sort";
import { listTasks } from "@/lib/tasks";
import { QueueView } from "./queue-view";

export default async function Home() {
  // better-sqlite3 is synchronous, so without this the page would be built once at `next build`.
  await connection();
  const today = localDay(new Date().toISOString());
  const queue = buildQueue(listTasks(getDb()), today);
  return (
    <main>
      <h1>Focusqueue</h1>
      <QueueView queue={queue} today={today} />
    </main>
  );
}
