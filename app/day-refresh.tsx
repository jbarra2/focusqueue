"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { localDay, msUntilMidnight } from "@/lib/date";

// The timer waits this long past midnight, so the clock has certainly reached the new day.
const MIDNIGHT_SLACK_MS = 1000;

/**
 * The page works out "today" on the server, so a page left open overnight would keep showing
 * yesterday's Do now and Due soon. This asks the server for a fresh page at local midnight, and
 * when the tab becomes visible again on a later day (a laptop that slept, or a tab that was in the
 * background and had its timer delayed). It draws nothing.
 */
export function DayRefresh({ today }: { today: string }) {
  const router = useRouter();

  useEffect(() => {
    let timer: number | undefined;

    const refreshIfNewDay = () => {
      if (localDay(new Date().toISOString()) !== today) router.refresh();
    };

    // After a refresh the page passes the new day, which starts this effect again. The timer is set
    // again here anyway, so a refresh that failed is tried again at the next midnight.
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          refreshIfNewDay();
          schedule();
        },
        msUntilMidnight(new Date()) + MIDNIGHT_SLACK_MS,
      );
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshIfNewDay();
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [today, router]);

  return null;
}
