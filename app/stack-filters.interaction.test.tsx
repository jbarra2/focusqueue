// @vitest-environment happy-dom
import { act, startTransition } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FILTERS, filterHref, parseSearchParams, type Filters } from "@/lib/filter";
import type { Group } from "@/lib/task";
import { StackFilters } from "./stack-filters";

// These tests run the filter controls in a simulated page. The router is a stand-in that records
// each navigation, and a test plays the server's reply by rendering again with the filters that
// the page would read from that URL.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

// The Add dialog calls this Server Action. Here it is a stand-in, so the real one, which reaches
// the database, is never loaded.
const addTaskAction = vi.hoisted(() => vi.fn());

vi.mock("./actions", () => ({ addTaskAction }));

const groups: Group[] = [
  { name: "Home", color: 1 },
  { name: "Work", color: 2 },
];
const TODAY = "2026-10-19";

let container: HTMLDivElement;
let root: Root;

function renderFilters(filters: Filters, count = 3) {
  // In a browser the address is the one the page was rendered for, so the simulated page's is too.
  window.history.replaceState(NEXT_ENTRY_STATE, "", filterHref(filters));
  root.render(<StackFilters filters={filters} groups={groups} today={TODAY} count={count} />);
}

function show(filters: Filters = DEFAULT_FILTERS, count = 3) {
  act(() => renderFilters(filters, count));
}

/** The filters the page reads from an address. */
function filtersOf(href: string): Filters {
  const query = new URLSearchParams(href.split("?")[1] ?? "");
  return parseSearchParams(Object.fromEntries(query), groups).filters;
}

/** The page's answer to an address: it shows the filters it reads from it. */
function reply(href: string) {
  show(filtersOf(href));
}

// Every history entry Next makes has a state. A move to a #fragment fires popstate with none.
const NEXT_ENTRY_STATE = { __NA: true };

/**
 * Back or forward. The browser changes the address and fires popstate, whether or not the search
 * text in it differs from before, and then the page answers with the filters of that address.
 */
function back(href: string) {
  act(() => {
    window.history.replaceState(NEXT_ENTRY_STATE, "", href);
    window.dispatchEvent(new PopStateEvent("popstate", { state: NEXT_ENTRY_STATE }));
  });
  reply(href);
}

function sent(call: "push" | "replace", index = 0): string {
  return router[call].mock.calls[index]?.[0] as string;
}

function field(label: string): HTMLSelectElement | HTMLInputElement {
  const found = [...container.querySelectorAll("label.field")].find(
    (element) => element.querySelector("span")?.textContent === label,
  );
  const control = found?.querySelector<HTMLSelectElement | HTMLInputElement>("select, input");
  if (!control) throw new Error(`No ${label} field.`);
  return control;
}

function search(): HTMLInputElement {
  return field("Search by name") as HTMLInputElement;
}

function link(text: string): HTMLAnchorElement {
  const found = [...container.querySelectorAll("a")].find((a) => a.textContent === text);
  if (!found) throw new Error(`No ${text} link.`);
  return found;
}

function announcement(): string {
  return container.querySelector("[role=status]")?.textContent ?? "";
}

function type(value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(search(), value);
    search().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Text typed through an input method that is still composing, as the browser reports it. */
function typeComposing(value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(search(), value);
    search().dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
  });
}

function endComposition() {
  act(() => {
    search().dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
  });
}

function choose(label: string, value: string) {
  act(() => {
    const select = field(label);
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/**
 * Clicks, and says whether the page took the click over (it called preventDefault) or left it to
 * the browser, which for a link means opening its address. The spy is added after React's own
 * listener on the same element, so it sees the event once the page has handled it.
 */
function click(element: Element, init: MouseEventInit = {}): { takenOver: boolean } {
  let takenOver = false;
  const spy = (event: Event) => {
    takenOver = event.defaultPrevented;
  };
  container.addEventListener("click", spy);
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
  });
  container.removeEventListener("click", spy);
  return { takenOver };
}

// A click the page leaves alone would make the simulated page try to load the address.
const stopLinks = (event: Event) => event.preventDefault();

// Next keeps a navigation pending until the server has answered. This stand-in does the same for
// every push and replace, until the test answers the oldest one still waiting. An answer also shows
// the filters of its address in the same step, which is how Next commits it. A navigation that a
// newer one replaced is never answered: Next drops it, and `drop` does the same.
// Navigations that no test answered are released after each test, so one test's pending
// navigation can never keep the next test's component busy.
const waiting: Array<() => void> = [];

function slowRouter() {
  const hold = () => {
    startTransition(async () => {
      await new Promise<void>((resolve) => waiting.push(resolve));
    });
  };
  router.push.mockImplementation(hold);
  router.replace.mockImplementation(hold);
  return {
    answer: (href?: string, count = 3) =>
      act(async () => {
        if (href !== undefined) renderFilters(filtersOf(href), count);
        waiting.shift()?.();
      }),
    drop: () =>
      act(async () => {
        waiting.shift()?.();
      }),
  };
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.useFakeTimers();
  document.addEventListener("click", stopLinks);
  router.push.mockReset();
  router.replace.mockReset();
  waiting.length = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    for (const finish of waiting.splice(0)) finish();
  });
  act(() => root.unmount());
  document.removeEventListener("click", stopLinks);
  document.body.innerHTML = "";
  vi.useRealTimers();
  // React reports misuse, such as an optimistic update outside a transition, with console.error.
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

describe("the view links", () => {
  it("has a link for each view, with the current one marked", () => {
    show({ ...DEFAULT_FILTERS, view: "later" });
    const links = [...container.querySelectorAll("nav[aria-label='Stacks'] a")];
    expect(links.map((a) => a.textContent)).toEqual([
      "Up next",
      "Due soon",
      "Rest of this week",
      "Later",
      "Completed",
    ]);
    expect(links.map((a) => a.getAttribute("aria-current"))).toEqual([
      null,
      null,
      null,
      "page",
      null,
    ]);
  });

  it("points each at its own view, with Up next as the bare path", () => {
    show();
    expect(link("Up next").getAttribute("href")).toBe("/");
    expect(link("Due soon").getAttribute("href")).toBe("/?view=due-soon");
    expect(link("Rest of this week").getAttribute("href")).toBe("/?view=rest-of-week");
    expect(link("Completed").getAttribute("href")).toBe("/?view=completed");
  });

  it("keeps the group, difficulty and search in each address", () => {
    show({
      view: "up-next",
      group: { kind: "named", name: "Work" },
      difficulty: "high",
      q: "plan",
    });
    expect(link("Later").getAttribute("href")).toBe(
      "/?view=later&group=Work&difficulty=high&q=plan",
    );
  });

  it("carries the search text that is in the box in each address, before it has been sent", () => {
    show();
    type("plan");
    expect(link("Later").getAttribute("href")).toBe("/?view=later&q=plan");
  });

  it("goes to the view through the router on a plain click, and keeps the filters", () => {
    show({ ...DEFAULT_FILTERS, group: { kind: "named", name: "Work" }, difficulty: "high" });
    const { takenOver } = click(link("Later"));
    expect(takenOver).toBe(true);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(sent("push")).toBe("/?view=later&group=Work&difficulty=high");
    expect(router.push.mock.calls[0][1]).toEqual({ scroll: false });
  });

  it("sends the search text that is in the box with it, and not a second time", () => {
    show();
    type("plan");
    click(link("Later"));
    expect(sent("push")).toBe("/?view=later&q=plan");
    expect(vi.getTimerCount()).toBe(0);
    wait(500);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("marks the new view at once, before the server has answered", async () => {
    const server = slowRouter();
    show();
    click(link("Completed"));
    expect(link("Completed").getAttribute("aria-current")).toBe("page");
    expect(link("Up next").hasAttribute("aria-current")).toBe(false);
    await server.answer();
  });

  it("is not undone by a menu change made before the server has answered", async () => {
    const server = slowRouter();
    show();
    click(link("Later"));
    choose("Difficulty", "high");
    expect(sent("push", 1)).toBe("/?view=later&difficulty=high");
    await server.answer();
  });

  it("leaves a click that opens a new tab to the browser, and still sends the search", () => {
    show();
    type("plan");
    for (const init of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ]) {
      const { takenOver } = click(link("Later"), init);
      expect(takenOver).toBe(false);
    }
    expect(router.push).not.toHaveBeenCalled();
    wait(250);
    expect(sent("replace")).toBe("/?q=plan");
  });
});

describe("the menus", () => {
  it("lists the groups in use between all groups and no group", () => {
    show();
    const options = [...field("Group").querySelectorAll("option")].map((o) => o.textContent);
    expect(options).toEqual(["All groups", "Home", "Work", "No group"]);
    const difficulty = [...field("Difficulty").querySelectorAll("option")].map(
      (o) => o.textContent,
    );
    expect(difficulty).toEqual(["All", "Low", "Medium", "High"]);
  });

  describe("a long group name", () => {
    const LONG = "Quarterly planning meeting with the whole team";
    const TWENTY = "Exactly twenty chars"; // 20 characters: not cut
    const TWENTY_ONE = "Exactly twenty chars!"; // 21 characters: cut

    function showGroups(names: string[], filters: Filters = DEFAULT_FILTERS) {
      window.history.replaceState(NEXT_ENTRY_STATE, "", filterHref(filters));
      const withGroups = names.map((name, i) => ({ name, color: i + 1 }));
      act(() =>
        root.render(<StackFilters filters={filters} groups={withGroups} today={TODAY} count={3} />),
      );
    }

    function labels(): (string | null)[] {
      return [...field("Group").querySelectorAll("option")].map((o) => o.textContent);
    }

    // The menu and the row it is in must not grow because of one long name.
    it("is shown cut short, ending with an ellipsis, so the menu does not grow", () => {
      showGroups([LONG, "Home"]);
      expect(labels()).toEqual(["All groups", "Quarterly planning…", "Home", "No group"]);
    });

    it("keeps its full name as the value, and filters by the whole name when chosen", () => {
      showGroups([LONG]);
      const option = [...field("Group").querySelectorAll("option")][1] as HTMLOptionElement;
      expect(option.value).toBe(`g:${LONG}`);
      choose("Group", `g:${LONG}`);
      expect(sent("push")).toBe(`/?${new URLSearchParams({ group: LONG })}`);
    });

    it("has the full name as a tooltip while it is the chosen group, and no tooltip otherwise", () => {
      showGroups([LONG], { ...DEFAULT_FILTERS, group: { kind: "named", name: LONG } });
      expect(field("Group").title).toBe(LONG);
      expect(field("Group").value).toBe(`g:${LONG}`);
      showGroups([LONG], { ...DEFAULT_FILTERS, group: { kind: "none" } });
      expect(field("Group").title).toBe("");
      showGroups([LONG]);
      expect(field("Group").title).toBe("");
    });

    it("is not cut at 20 characters, and is cut at 21", () => {
      expect(TWENTY).toHaveLength(20);
      expect(TWENTY_ONE).toHaveLength(21);
      showGroups([TWENTY, TWENTY_ONE]);
      expect(labels()).toEqual(["All groups", TWENTY, "Exactly twenty char…", "No group"]);
    });

    it("leaves short names as they are", () => {
      showGroups(["Home", "Work"]);
      expect(labels()).toEqual(["All groups", "Home", "Work", "No group"]);
    });

    it("is cut in the menu only, and the Add dialog still suggests the whole name", () => {
      showGroups([LONG]);
      act(() => container.querySelector<HTMLButtonElement>("button.add-task")!.click());
      const suggested = [...container.querySelectorAll("dialog datalist option")].map((o) =>
        o.getAttribute("value"),
      );
      expect(suggested).toEqual([LONG]);
    });
  });

  it("has a visible label on every control", () => {
    show();
    const labels = [...container.querySelectorAll("label.field > span")].map((s) => s.textContent);
    expect(labels).toEqual(["Group", "Difficulty", "Search by name"]);
  });

  it("goes to the chosen group, and back to all groups", () => {
    show();
    choose("Group", "g:Home");
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(sent("push")).toBe("/?group=Home");
    expect(router.push.mock.calls[0][1]).toEqual({ scroll: false });
    reply("/?group=Home");
    choose("Group", "all");
    expect(sent("push", 1)).toBe("/");
  });

  it("goes to No group with its own parameter", () => {
    show();
    choose("Group", "none");
    expect(sent("push")).toBe("/?nogroup=1");
  });

  it("goes to the chosen difficulty and keeps the view and group", () => {
    show({ ...DEFAULT_FILTERS, view: "rest-of-week", group: { kind: "named", name: "Work" } });
    choose("Difficulty", "low");
    expect(sent("push")).toBe("/?view=rest-of-week&group=Work&difficulty=low");
  });

  it("goes back to every difficulty with All, and to each difficulty when it is chosen", () => {
    show({ ...DEFAULT_FILTERS, difficulty: "low" });
    choose("Difficulty", "all");
    expect(sent("push")).toBe("/");
    reply("/");
    for (const [value, param] of [
      ["low", "low"],
      ["med", "med"],
      ["high", "high"],
    ]) {
      choose("Difficulty", value);
      expect(sent("push", router.push.mock.calls.length - 1)).toBe(`/?difficulty=${param}`);
      reply("/");
    }
  });

  it("shows the group the URL names, in the case the group is stored in", () => {
    reply("/?group=WORK");
    expect(field("Group").value).toBe("g:Work");
  });

  it("shows the new choice at once, before the server has answered", async () => {
    const server = slowRouter();
    show();
    choose("Difficulty", "high");
    expect(field("Difficulty").value).toBe("high");
    await server.answer("/?difficulty=high");
    expect(field("Difficulty").value).toBe("high");
  });

  it("builds a second change on the first when the server has not answered yet", async () => {
    const server = slowRouter();
    show();
    choose("Group", "g:Home");
    choose("Difficulty", "high");
    expect(sent("push", 1)).toBe("/?group=Home&difficulty=high");
    expect(field("Group").value).toBe("g:Home");
    await server.answer();
  });
});

describe("the search box", () => {
  it("is a search field with a limit on its length", () => {
    show();
    expect(search().type).toBe("search");
    expect(search().maxLength).toBe(200);
  });

  it("waits for a pause, then sends the text once", () => {
    show();
    type("p");
    wait(200);
    type("pl");
    wait(200);
    type("plan");
    expect(router.replace).not.toHaveBeenCalled();
    wait(249);
    expect(router.replace).not.toHaveBeenCalled();
    wait(1);
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(sent("replace")).toBe("/?q=plan");
    expect(router.replace.mock.calls[0][1]).toEqual({ scroll: false });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("sends the text without the spaces around it, and keeps the view and filters", () => {
    show({ ...DEFAULT_FILTERS, view: "later", difficulty: "low" });
    type("  plan trip  ");
    wait(250);
    expect(sent("replace")).toBe("/?view=later&difficulty=low&q=plan+trip");
  });

  it("waits for an input method to finish composing before it sends anything", () => {
    show();
    typeComposing("ni");
    wait(1000);
    // The text is not final yet, so it is shown but not sent.
    expect(search().value).toBe("ni");
    expect(router.replace).not.toHaveBeenCalled();
    typeComposing("ni hao");
    wait(1000);
    expect(router.replace).not.toHaveBeenCalled();
    endComposition();
    wait(249);
    expect(router.replace).not.toHaveBeenCalled();
    wait(1);
    expect(sent("replace")).toBe("/?q=ni+hao");
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("sends once when a browser sends one more input event after the composition ends", () => {
    show();
    typeComposing("ab");
    endComposition();
    // Some browsers send a final input event after compositionend, with composing already over.
    type("ab");
    wait(250);
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(sent("replace")).toBe("/?q=ab");
  });

  it("sends at once when Enter is pressed, and the browser does not load the page", () => {
    show();
    type("plan");
    const submit = new Event("submit", { bubbles: true, cancelable: true });
    act(() => {
      search().closest("form")!.dispatchEvent(submit);
    });
    // Without this, a real Enter would load "/?" and every filter would be lost.
    expect(submit.defaultPrevented).toBe(true);
    expect(sent("replace")).toBe("/?q=plan");
    wait(500);
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("does nothing on Enter when the text has not changed", () => {
    show({ ...DEFAULT_FILTERS, q: "plan" });
    act(() => {
      search()
        .closest("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("cancels a search that is waiting when the page is closed", () => {
    show();
    type("plan");
    act(() => root.unmount());
    // The test's own cleanup unmounts once more, so give it a root to unmount.
    root = createRoot(container);
    wait(500);
    expect(router.replace).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not send again for a space typed at the end", () => {
    show();
    type("plan");
    wait(250);
    reply("/?q=plan");
    type("plan ");
    wait(250);
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("clears the search when the box is emptied", () => {
    show({ ...DEFAULT_FILTERS, q: "plan" });
    type("");
    wait(250);
    expect(sent("replace")).toBe("/");
  });

  it("keeps a space typed at the end when the server answers with the text trimmed", () => {
    show();
    type("plan ");
    wait(250);
    expect(sent("replace")).toBe("/?q=plan");
    reply("/?q=plan");
    expect(search().value).toBe("plan ");
  });

  it("keeps what is being typed when the answer to an earlier search arrives", async () => {
    const server = slowRouter();
    show();
    type("pl");
    wait(250);
    type("pla");
    // The answer to "pl" comes in while "pla" is still waiting for its pause.
    await server.answer("/?q=pl");
    expect(search().value).toBe("pla");
    wait(250);
    expect(sent("replace", 1)).toBe("/?q=pla");
    await server.answer("/?q=pla");
    expect(search().value).toBe("pla");
  });

  // Found in a real browser: with a slow answer, the answer to an older search can arrive just
  // after a newer one was sent. It is ours, and must not put the old text back in the box.
  it("keeps the box when the answer to an older search arrives after a newer one was sent", async () => {
    const server = slowRouter();
    show();
    type("pl");
    wait(250);
    type("pla");
    wait(250);
    type("plan");
    wait(250);
    expect(router.replace).toHaveBeenCalledTimes(3);
    await server.answer("/?q=pl");
    expect(search().value).toBe("plan");
    await server.answer("/?q=pla");
    expect(search().value).toBe("plan");
    await server.answer("/?q=plan");
    expect(search().value).toBe("plan");
  });

  it("still sends the search that was waiting when an older answer arrives", async () => {
    const server = slowRouter();
    show();
    type("pl");
    wait(250);
    type("pla");
    wait(250);
    type("plan");
    await server.answer("/?q=pl");
    expect(search().value).toBe("plan");
    wait(250);
    expect(sent("replace", 2)).toBe("/?q=plan");
  });

  it("keeps the box when the same text was sent more than once", async () => {
    const server = slowRouter();
    show();
    type("a");
    wait(250);
    type("ab");
    wait(250);
    type("a ");
    wait(250);
    // "a " is sent as "a" again. The answers come in order, and the middle one is not Back.
    expect(router.replace).toHaveBeenCalledTimes(3);
    await server.answer("/?q=a");
    expect(search().value).toBe("a ");
    await server.answer("/?q=ab");
    expect(search().value).toBe("a ");
    await server.answer("/?q=a");
    expect(search().value).toBe("a ");
  });

  it("keeps an emptied box when the empty text is sent more than once", async () => {
    const server = slowRouter();
    show({ ...DEFAULT_FILTERS, q: "x" });
    type("");
    wait(250);
    type("bab");
    wait(250);
    type("");
    wait(250);
    expect(router.replace).toHaveBeenCalledTimes(3);
    await server.answer("/");
    await server.answer("/?q=bab");
    expect(search().value).toBe("");
    await server.answer("/");
    expect(search().value).toBe("");
  });

  it("shows the earlier address when Back comes right after a search was sent", async () => {
    // The page was on an address with a search, and a new one was sent from the box.
    const server = slowRouter();
    show({ ...DEFAULT_FILTERS, q: "old" });
    type("pl");
    wait(250);
    expect(sent("replace")).toBe("/?q=pl");
    // The answer has not come, and Back goes to an address with no search.
    back("/");
    expect(search().value).toBe("");
    await server.drop();
    wait(500);
    expect(search().value).toBe("");
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("shows the earlier address when Back leaves the search text as it was", async () => {
    // Back to an address with no search, from one that also has none: the box still has to go.
    const server = slowRouter();
    show();
    type("pl");
    wait(250);
    expect(sent("replace")).toBe("/?q=pl");
    back("/");
    expect(search().value).toBe("");
    await server.drop();
    expect(search().value).toBe("");
  });

  it("drops a search that is waiting for its pause when Back comes, with the same text", () => {
    show();
    type("pl");
    // Nothing was sent yet. Back goes to an address that has no search, as before.
    back("/");
    expect(search().value).toBe("");
    wait(500);
    // Without this, the old text would be sent and would replace the address Back went to.
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("shows the search of an address Back goes to, after a search that was never answered", async () => {
    const server = slowRouter();
    show({ ...DEFAULT_FILTERS, q: "a" });
    type("");
    wait(250);
    type("a ");
    wait(250);
    // Next dropped the first search for the second, and Back goes to the address that has "a".
    await server.drop();
    back("/?q=a");
    expect(search().value).toBe("a");
    await server.drop();
    wait(500);
    expect(search().value).toBe("a");
    expect(router.replace).toHaveBeenCalledTimes(2);
  });

  it("shows the address Back goes to, after a search that was sent and answered", () => {
    show();
    type("plan");
    wait(250);
    reply("/?q=plan");
    // Back to an earlier address, which has no search.
    back("/");
    expect(search().value).toBe("");
    wait(500);
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  // The box is never rewritten because the address says something else. Working that out from
  // the props went wrong in a real browser under load, so only Back and Forward move it.
  it("keeps the box when the address changes without Back or Forward", () => {
    show({ ...DEFAULT_FILTERS, q: "plan" });
    reply("/");
    expect(search().value).toBe("plan");
    reply("/?q=other");
    expect(search().value).toBe("plan");
  });

  it("keeps what is typed when an answer comes in in the same step as the pause ends", async () => {
    // Found in real Chrome under CPU load, with an earlier design that decided from the props
    // whether an answer was its own: the answer to the first search and the pause of the second
    // ended together, and the answer put the first text back in the box. The box is no longer
    // rewritten by an answer at all, so this checks that it stays that way. It cannot recreate the
    // exact moment, which falls between React's commit and its effects.
    const server = slowRouter();
    show();
    type("p");
    wait(250);
    type("pl");
    await act(async () => {
      renderFilters(filtersOf("/?q=p"), 3);
      waiting.shift()?.();
      vi.advanceTimersByTime(250);
    });
    expect(search().value).toBe("pl");
    expect(sent("replace", 1)).toBe("/?q=pl");
    type("pla");
    wait(250);
    expect(sent("replace", 2)).toBe("/?q=pla");
    await server.answer("/?q=pl");
    await server.answer("/?q=pla");
    expect(search().value).toBe("pla");
  });

  it("ignores a move to a #fragment on the page, and still sends the search that was waiting", () => {
    show();
    type("pl");
    // A skip link would do this. The event has no state.
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });
    expect(search().value).toBe("pl");
    wait(250);
    expect(sent("replace")).toBe("/?q=pl");
  });

  it("sends text typed right after Back, even when it is what was there before Back", () => {
    // The page had the search "a". Back goes to an address with none. Typing "a" again has to
    // be sent, because the address now has no search, whatever the page showed a moment ago.
    show({ ...DEFAULT_FILTERS, q: "a" });
    back("/");
    expect(search().value).toBe("");
    type("a");
    wait(250);
    expect(sent("replace")).toBe("/?q=a");
  });

  it("does not send again text the address already has after Back", () => {
    show();
    back("/?q=a");
    expect(search().value).toBe("a");
    type("a ");
    wait(250);
    expect(router.replace).not.toHaveBeenCalled();
  });

  // Found in real Chrome: Back pressed after a reload but before React hydrated has no listener to
  // tell the box. Next replays the move for the page, but the box and the text it compares against
  // were made from the old address.
  it("takes the address when Back happened before the component started", () => {
    window.history.replaceState(NEXT_ENTRY_STATE, "", "/?q=ac");
    act(() =>
      root.render(
        <StackFilters
          filters={{ ...DEFAULT_FILTERS, q: "acb" }}
          groups={groups}
          today={TODAY}
          count={3}
        />,
      ),
    );
    expect(search().value).toBe("ac");
    // Typing what the page had before Back must be sent, because the address does not have it.
    type("acb");
    wait(250);
    expect(sent("replace")).toBe("/?q=acb");
  });

  it("leaves the box alone at the start when the address and the page agree", () => {
    show({ ...DEFAULT_FILTERS, q: "plan" });
    expect(search().value).toBe("plan");
    type("plan b");
    wait(250);
    expect(sent("replace")).toBe("/?q=plan+b");
  });

  it("reads the address at the start the way the server does", () => {
    // A search given twice, or too long, is no search on the server, so the page has none.
    for (const address of ["/?q=a&q=b", `/?q=${"x".repeat(250)}`]) {
      window.history.replaceState(NEXT_ENTRY_STATE, "", address);
      act(() =>
        root.render(
          <StackFilters filters={DEFAULT_FILTERS} groups={groups} today={TODAY} count={3} />,
        ),
      );
      expect(search().value).toBe("");
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it("stops listening for Back and Forward when it is closed", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    show();
    act(() => root.unmount());
    expect(remove.mock.calls.some(([eventType]) => eventType === "popstate")).toBe(true);
    remove.mockRestore();
    // The test's own cleanup unmounts once more, so give it a root to unmount.
    root = createRoot(container);
  });

  it("drops a search that was still waiting when Back changed the URL", () => {
    show({ ...DEFAULT_FILTERS, q: "old" });
    type("typed");
    back("/");
    expect(search().value).toBe("");
    wait(500);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("starts with the search of the URL", () => {
    show({ ...DEFAULT_FILTERS, q: "plan" });
    expect(search().value).toBe("plan");
  });
});

describe("a menu change while the search is waiting", () => {
  it("sends the typed text with it, and does not send it a second time", () => {
    show();
    type("pl");
    choose("Difficulty", "low");
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(sent("push")).toBe("/?difficulty=low&q=pl");
    // The search that was waiting is cancelled, not left to run and find nothing to do.
    expect(vi.getTimerCount()).toBe(0);
    wait(500);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("is not undone by the search that was waiting", () => {
    show();
    type("pl");
    choose("Group", "g:Work");
    wait(500);
    // Only the one navigation happened, and it has both.
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(sent("push")).toBe("/?group=Work&q=pl");
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("Clear filters", () => {
  const filtered: Filters = {
    view: "later",
    group: { kind: "named", name: "Home" },
    difficulty: "low",
    q: "",
  };

  it("is there, but inactive, when only the view is set, and a click does nothing", () => {
    show({ ...DEFAULT_FILTERS, view: "completed" });
    expect(link("Clear filters").getAttribute("aria-disabled")).toBe("true");
    const { takenOver } = click(link("Clear filters"));
    // The page took the click over, so the browser does not follow the address.
    expect(takenOver).toBe(true);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("is active for a group or a difficulty, and keeps the view", () => {
    for (const filters of [
      { ...DEFAULT_FILTERS, view: "later", group: { kind: "none" } },
      { ...DEFAULT_FILTERS, view: "later", difficulty: "low" },
    ] as Filters[]) {
      show(filters);
      expect(link("Clear filters").hasAttribute("aria-disabled")).toBe(false);
      expect(link("Clear filters").getAttribute("href")).toBe("/?view=later");
    }
  });

  it("is active when the page opens with a search, and keeps the view", () => {
    show({ ...DEFAULT_FILTERS, view: "later", q: "plan" });
    expect(link("Clear filters").hasAttribute("aria-disabled")).toBe(false);
    expect(link("Clear filters").getAttribute("href")).toBe("/?view=later");
  });

  it("becomes active as soon as there is text in the box, and inactive when it is emptied", () => {
    show();
    expect(link("Clear filters").getAttribute("aria-disabled")).toBe("true");
    type("p");
    expect(link("Clear filters").hasAttribute("aria-disabled")).toBe(false);
    type("");
    expect(link("Clear filters").getAttribute("aria-disabled")).toBe("true");
  });

  it("goes to the view with no filters, empties the box, and cancels a search that was waiting", () => {
    show(filtered);
    type("plan");
    const { takenOver } = click(link("Clear filters"));
    expect(takenOver).toBe(true);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(sent("push")).toBe("/?view=later");
    expect(search().value).toBe("");
    expect(vi.getTimerCount()).toBe(0);
    wait(500);
    expect(router.replace).not.toHaveBeenCalled();
    // The page answers with no filters, and the box stays empty.
    reply("/?view=later");
    expect(search().value).toBe("");
    expect(field("Difficulty").value).toBe("all");
    expect(field("Group").value).toBe("all");
  });

  it("resets the menus at once, before the server has answered", async () => {
    const server = slowRouter();
    show(filtered);
    expect(field("Difficulty").value).toBe("low");
    click(link("Clear filters"));
    expect(field("Difficulty").value).toBe("all");
    expect(field("Group").value).toBe("all");
    await server.answer();
  });

  it("leaves everything alone when the click opens a new tab", () => {
    show({ ...filtered, q: "plan" });
    const { takenOver } = click(link("Clear filters"), { metaKey: true });
    expect(takenOver).toBe(false);
    expect(search().value).toBe("plan");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("stays in place and keeps keyboard focus when it becomes inactive", () => {
    show(filtered);
    const clear = link("Clear filters");
    act(() => clear.focus());
    expect(document.activeElement).toBe(clear);
    click(clear);
    reply("/?view=later");
    // The same element, not one made again, so focus was not lost to the page body.
    expect(link("Clear filters")).toBe(clear);
    expect(clear.getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(clear);
  });
});

describe("the announcement of the result", () => {
  it("is a status region that screen readers read, and that is not drawn", () => {
    show();
    const region = container.querySelector("[role=status]");
    expect(region).not.toBeNull();
    expect(region?.classList.contains("visually-hidden")).toBe(true);
  });

  it("says the view and how many tasks it shows, and follows the answer from the server", () => {
    show(DEFAULT_FILTERS, 3);
    expect(announcement()).toBe("Up next: 3 tasks");
    show({ ...DEFAULT_FILTERS, view: "later" }, 1);
    expect(announcement()).toBe("Later: 1 task");
    show({ ...DEFAULT_FILTERS, view: "completed", q: "zzz" }, 0);
    expect(announcement()).toBe("Completed: 0 tasks");
  });

  it("does not run ahead of the server: a choice is announced when its result arrives", async () => {
    const server = slowRouter();
    show(DEFAULT_FILTERS, 3);
    click(link("Completed"));
    // The view is marked at once, but the count is the server's, so it has not changed yet.
    expect(announcement()).toBe("Up next: 3 tasks");
    await server.answer("/?view=completed", 2);
    expect(announcement()).toBe("Completed: 2 tasks");
  });
});

describe("Add a task from the header", () => {
  const MOST_FILTERS: Filters = {
    view: "later",
    group: { kind: "named", name: "Home" },
    difficulty: "high",
    q: "plan",
  };

  function dialogField(name: string): HTMLInputElement {
    return container.querySelector<HTMLInputElement>(`dialog [name=${name}]`)!;
  }

  /** Opens the dialog, fills the two required fields with a made-up task, and sends it. */
  async function addTask(answer: unknown) {
    addTaskAction.mockResolvedValue(answer);
    act(() => container.querySelector<HTMLButtonElement>("button.add-task")!.click());
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        dialogField("name"),
        "Pay the rent",
      );
      dialogField("name").dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() =>
      container.querySelector<HTMLInputElement>("dialog [name=difficulty][value=med]")!.click(),
    );
    await act(async () => {
      container
        .querySelector("dialog form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  }

  it("has the button and the dialog in the header, and the dialog is not inside the filter form", () => {
    show();
    expect(container.querySelector("button.add-task")!.textContent).toBe("Add a task");
    expect(container.querySelector("form[role=search] dialog")).toBeNull();
    expect(container.querySelector("form[role=search] .add-task")).toBeNull();
  });

  // The page is in the same order as the screen, so Tab goes the way the eye does: the top row has
  // Add a task at its left end and then the filters, and the view links are the row under it.
  it("puts Add a task at the left end of the top row, then the filters, and the view links under it", () => {
    show();
    const row = container.querySelector(".filter-row")!;
    const search = row.querySelector("form[role=search]")!;
    const add = row.querySelector("button.add-task")!;
    const views = container.querySelector("nav[aria-label='Stacks']")!;
    expect(row.parentElement).toBe(views.parentElement);
    // Inside the row: the button, which is the first thing in it, and then the filters.
    expect([...row.children].filter((el) => el !== row.querySelector("dialog"))).toEqual([
      add,
      search,
    ]);
    expect(add.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The row is above the view links, in the page and so for Tab.
    expect(row.compareDocumentPosition(views) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(search.querySelector("input[type=search]")).not.toBeNull();
    expect(views.contains(add)).toBe(false);
  });

  it("gives the dialog the groups, so a name that exists keeps its color", () => {
    show();
    act(() => container.querySelector<HTMLButtonElement>("button.add-task")!.click());
    expect(
      [...container.querySelectorAll("dialog datalist option")].map((o) => o.getAttribute("value")),
    ).toEqual(["Home", "Work"]);
  });

  it("starts the new task on today's date", () => {
    show();
    act(() => container.querySelector<HTMLButtonElement>("button.add-task")!.click());
    expect(dialogField("dueDate").value).toBe(TODAY);
  });

  it("shows the new task on Up next with no filters, the task in focus, as one history entry", async () => {
    show(MOST_FILTERS);
    await addTask({ ok: true, id: "11111111-1111-4111-8111-111111111111" });
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/?task=11111111-1111-4111-8111-111111111111", {
      scroll: false,
    });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("marks Up next and clears the menus and the search box at once, before the server answers", async () => {
    // The navigation is held open, as when the server is slow. The page shows the new choices while
    // it waits, and drops them if the server never answers.
    slowRouter();
    show(MOST_FILTERS);
    expect(search().value).toBe("plan");
    await addTask({ ok: true, id: "new-id" });
    expect(link("Up next").getAttribute("aria-current")).toBe("page");
    expect(link("Later").getAttribute("aria-current")).toBeNull();
    expect(field("Group").value).toBe("all");
    expect(field("Difficulty").value).toBe("all");
    expect(search().value).toBe("");
  });

  it("closes the dialog", async () => {
    show();
    await addTask({ ok: true, id: "new-id" });
    expect(container.querySelector("dialog")!.hasAttribute("open")).toBe(false);
  });

  it("can send the old search text again afterwards, because the box and the address agree it is gone", async () => {
    show({ ...DEFAULT_FILTERS, q: "plan" });
    await addTask({ ok: true, id: "new-id" });
    // The server's answer: Up next, nothing searched.
    reply("/?task=new-id");
    expect(search().value).toBe("");
    type("plan");
    wait(250);
    expect(sent("replace")).toBe("/?q=plan");
  });

  it("drops a search that was still waiting for its pause", async () => {
    show();
    type("abc");
    await addTask({ ok: true, id: "new-id" });
    wait(1000);
    expect(router.replace).not.toHaveBeenCalled();
    expect(search().value).toBe("");
  });

  it("changes nothing when the task is refused or the action fails", async () => {
    show(MOST_FILTERS);
    await addTask({ ok: false, message: "Enter a name." });
    expect(router.push).not.toHaveBeenCalled();
    expect(search().value).toBe("plan");
    expect(link("Later").getAttribute("aria-current")).toBe("page");
    expect(field("Group").value).toBe("g:Home");
    expect(container.querySelector("dialog")!.hasAttribute("open")).toBe(true);
    expect(container.querySelector("dialog [role=alert]")!.textContent).toBe("Enter a name.");
  });

  it("builds on the choices of a menu change that is still waiting for the server", async () => {
    // A task is added while an earlier choice has not been answered yet. The new task still goes to
    // Up next with no filters, whatever was chosen before.
    const server = slowRouter();
    show();
    choose("Difficulty", "high");
    await addTask({ ok: true, id: "new-id" });
    expect(sent("push", 1)).toBe("/?task=new-id");
    await server.answer("/?task=new-id");
    expect(field("Difficulty").value).toBe("all");
  });
});
