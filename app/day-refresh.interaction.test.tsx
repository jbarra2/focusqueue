// @vitest-environment happy-dom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { msUntilMidnight } from "@/lib/date";
import { DayRefresh } from "./day-refresh";

// The component draws nothing. These tests run it in a simulated page with a fake clock and a
// router stand-in that counts how many times the page was asked to refresh.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

const MINUTE = 60_000;
const DAY = "2026-10-19";
const NEXT_DAY = "2026-10-20";

let container: HTMLDivElement;
let root: Root;

function show(today: string) {
  act(() => root.render(<DayRefresh today={today} />));
}

/** Moves the fake clock forward and runs every timer that falls due. */
function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(() => {
  // Evening on the page's day, in local time, whatever the time zone of the machine.
  vi.useFakeTimers({ now: new Date(2026, 9, 19, 23, 30) });
  router.refresh.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  Reflect.deleteProperty(document, "visibilityState");
  vi.useRealTimers();
});

describe("DayRefresh at midnight", () => {
  it("draws nothing", () => {
    show(DAY);
    expect(container.innerHTML).toBe("");
  });

  it("does not refresh before midnight", () => {
    show(DAY);
    wait(29 * MINUTE);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("refreshes once, just after midnight", () => {
    show(DAY);
    wait(msUntilMidnight(new Date()) + 2000);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("starts again for the next midnight when the page shows the new day", () => {
    show(DAY);
    wait(msUntilMidnight(new Date()) + 2000);
    expect(router.refresh).toHaveBeenCalledTimes(1);

    // The server's answer: the same component, now with the new day.
    show(NEXT_DAY);
    wait(23 * 60 * MINUTE);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    wait(2 * 60 * MINUTE);
    expect(router.refresh).toHaveBeenCalledTimes(2);
  });

  it("compares with the new day once the page shows it, so coming back to the tab is quiet", () => {
    show(DAY);
    wait(msUntilMidnight(new Date()) + 2000);
    show(NEXT_DAY);
    expect(router.refresh).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    setVisibility("visible");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("tries again at the next midnight when the refresh brought nothing new", () => {
    show(DAY);
    wait(msUntilMidnight(new Date()) + 2000);
    // No new day arrives (the server did not answer). A whole day later it asks again.
    wait(24 * 60 * MINUTE);
    expect(router.refresh).toHaveBeenCalledTimes(2);
  });

  it("stops its timer when the page is closed", () => {
    show(DAY);
    act(() => root.unmount());
    wait(2 * 60 * MINUTE);
    expect(router.refresh).not.toHaveBeenCalled();
    // The test's own cleanup unmounts once more, so give it a root to unmount.
    root = createRoot(container);
  });
});

describe("DayRefresh when the tab comes back", () => {
  it("refreshes when the tab becomes visible on a later day", () => {
    show(DAY);
    setVisibility("hidden");
    // A laptop slept through midnight, and its timer did not run.
    vi.setSystemTime(new Date(2026, 9, 20, 7, 0));
    setVisibility("visible");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the tab becomes visible on the same day", () => {
    show(DAY);
    setVisibility("hidden");
    vi.setSystemTime(new Date(2026, 9, 19, 23, 45));
    setVisibility("visible");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("does nothing when the tab goes into the background, even on a later day", () => {
    show(DAY);
    vi.setSystemTime(new Date(2026, 9, 20, 7, 0));
    setVisibility("hidden");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("stops listening when the page is closed", () => {
    show(DAY);
    act(() => root.unmount());
    vi.setSystemTime(new Date(2026, 9, 20, 7, 0));
    setVisibility("visible");
    expect(router.refresh).not.toHaveBeenCalled();
    root = createRoot(container);
  });
});

describe("DayRefresh under StrictMode", () => {
  // In development React runs the effect, undoes it and runs it again, so a timer or a listener
  // that was not cleaned up would still be there, and the page would refresh twice.
  function showStrict(today: string) {
    act(() =>
      root.render(
        <StrictMode>
          <DayRefresh today={today} />
        </StrictMode>,
      ),
    );
  }

  it("refreshes once at midnight, so one timer is left", () => {
    showStrict(DAY);
    wait(msUntilMidnight(new Date()) + 2000);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes once when the tab becomes visible on a later day, so one listener is left", () => {
    showStrict(DAY);
    setVisibility("hidden");
    vi.setSystemTime(new Date(2026, 9, 20, 7, 0));
    setVisibility("visible");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
});
