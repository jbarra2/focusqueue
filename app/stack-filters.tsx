"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  DEFAULT_FILTERS,
  filterHref,
  hasActiveFilters,
  SEARCH_MAX_LENGTH,
  searchTextOf,
  viewLabel,
  VIEWS,
  type Filters,
  type GroupFilter,
  type View,
} from "@/lib/filter";
import { truncateLabel } from "@/lib/format";
import type { Difficulty, Group } from "@/lib/task";
import { AddTask } from "./add-task";

// The search narrows the stack this long after the last key, not on every key.
const SEARCH_PAUSE_MS = 250;

// The Group menu shows a group name longer than this cut short, ending with an ellipsis, so one
// long name cannot make the menu, and the row it is in, grow. The option's value is still the full
// name, so choosing it filters by the whole group.
const GROUP_MENU_MAX_CHARACTERS = 20;

type Props = {
  filters: Filters;
  /** The groups in use: their names fill the group menu, and the Add dialog needs their colors. */
  groups: Group[];
  /** Today as YYYY-MM-DD, the due date a task added from the header starts with. */
  today: string;
  /** How many tasks the stack shows now, announced to screen readers when it changes. */
  count: number;
};

/** A menu value is only used inside this component. It never reaches the URL. */
function groupValue(group: GroupFilter): string {
  if (group.kind === "none") return "none";
  return group.kind === "named" ? `g:${group.name}` : "all";
}

function groupFromValue(value: string): GroupFilter {
  if (value === "none") return { kind: "none" };
  return value.startsWith("g:") ? { kind: "named", name: value.slice(2) } : { kind: "all" };
}

function difficultyFromValue(value: string): Difficulty | null {
  return value === "low" || value === "med" || value === "high" ? value : null;
}

/** A plain left click. Any other click, such as one that opens a new tab, is left to the browser. */
function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

// The filters live in the URL, and the server picks the tasks, so every change is a navigation,
// and every navigation goes through one function. The controls show the new value at once while
// the server answers. A second change before that answer builds on the first, and the search text
// is kept in the box and sent after a pause.
//
// The box is never rewritten because of what the address says. It follows the address in one case
// only, Back or Forward, which the browser announces with popstate. Working out from the props
// whether a change of the address was this box's own or someone else's depends on the order in
// which React commits and runs effects, and that went wrong in a real browser under load.
export function StackFilters({ filters, groups, today, count }: Props) {
  const router = useRouter();
  const [shown, setShown] = useOptimistic(filters);
  const [text, setText] = useState(filters.q);

  // The newest filters, for the timer, which would otherwise use the ones from when it was set.
  const shownRef = useRef(shown);
  // The search that is waiting for its pause.
  const timer = useRef<number | undefined>(undefined);
  // The search text the address has, or is on its way to have: what this box last sent, or what
  // Back or Forward went to. The box sends text only when it differs from this, so a space typed at
  // the end sends nothing, and text typed right after Back is not mistaken for what was there.
  const intendedQ = useRef(filters.q);

  useEffect(() => {
    shownRef.current = shown;
  });

  const cancelSearch = useCallback(() => window.clearTimeout(timer.current), []);

  useEffect(() => cancelSearch, [cancelSearch]);

  // A Back or Forward pressed before this component hydrated had no listener to tell it. Next
  // replays that move for the page itself, but the box and intendedQ were made from the address
  // the page was rendered for. So the address is read once when the component starts, with the
  // same rule the server used, and the box takes it if it differs.
  useEffect(() => {
    const q = searchTextOf(window.location.search);
    if (q === filters.q) return;
    intendedQ.current = q;
    setText(q);
  }, []);

  // Back and forward change the address without going through navigate, and the search text in
  // the address may be the same as before, so only this event says it happened. The box shows the
  // text of the address, and a search that was waiting is dropped. A move to a #fragment on the
  // page also fires popstate, but with no state, and changes nothing here. Every entry Next makes
  // has a state.
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      if (event.state === null) return;
      cancelSearch();
      const q = searchTextOf(window.location.search);
      intendedQ.current = q;
      setText(q);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [cancelSearch]);

  const navigate = useCallback(
    (
      patch: Partial<Filters>,
      mode: "push" | "replace",
      query: string,
      focusTaskId: string | null = null,
    ) => {
      cancelSearch();
      const next: Filters = { ...shownRef.current, ...patch, q: query.trim() };
      intendedQ.current = next.q;
      startTransition(() => {
        setShown(next);
        router[mode](filterHref(next, focusTaskId), { scroll: false });
      });
    },
    [cancelSearch, router, setShown],
  );

  // A task was just added. The page shows it: Up next with no filters, which always has it, and it
  // is the card that takes the focus. The search box is cleared with the filters. The box is never
  // rewritten because of the address, so it is emptied here, and navigate sets intendedQ to the
  // same empty text and drops a search that was waiting. Without that, the old search text would
  // look like what the address already has, and typing it again would send nothing.
  const showNewTask = useCallback(
    (id: string) => {
      setText("");
      navigate(DEFAULT_FILTERS, "push", "", id);
    },
    [navigate],
  );

  function sendSearch(value: string) {
    if (value.trim() !== intendedQ.current) navigate({}, "replace", value);
  }

  function onSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setText(value);
    cancelSearch();
    // While an input method is still composing (for example Chinese or Japanese), the text is not
    // final, so nothing is sent until the composition ends.
    if ((event.nativeEvent as InputEvent).isComposing) return;
    timer.current = window.setTimeout(() => sendSearch(value), SEARCH_PAUSE_MS);
  }

  // The composition is final now: the usual pause starts. Some browsers send one more input event
  // after this, and it starts the same pause again.
  function onCompositionEnd(event: CompositionEvent<HTMLInputElement>) {
    const value = event.currentTarget.value;
    cancelSearch();
    timer.current = window.setTimeout(() => sendSearch(value), SEARCH_PAUSE_MS);
  }

  // Enter sends the search at once, instead of waiting for the pause.
  function onSubmit(event: FormEvent) {
    event.preventDefault();
    cancelSearch();
    sendSearch(text);
  }

  // A view link keeps the group, difficulty and the search text that is in the box. A plain click
  // goes through navigate, like every other change. The link's address is for the other clicks.
  function onViewClick(event: MouseEvent, view: View) {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    navigate({ view }, "push", text);
  }

  const withText: Filters = { ...shown, q: text.trim() };
  const canClear = hasActiveFilters(withText);

  // The link stays in place when there is nothing to clear, as inactive instead of gone, so focus
  // is not lost when it becomes inactive under the keyboard.
  function onClearClick(event: MouseEvent) {
    if (!canClear) {
      event.preventDefault();
      return;
    }
    if (!isPlainClick(event)) return;
    event.preventDefault();
    setText("");
    navigate({ group: DEFAULT_FILTERS.group, difficulty: null }, "push", "");
  }

  return (
    <div className="filters">
      {/* The search row is the top row, and the view links are under it. The page is in the same
          order as the screen, so Tab goes the way the eye does. */}
      <div className="filter-row">
        {/* At the left end of the row, but not inside the form: forms cannot be nested. */}
        <AddTask groups={groups} today={today} onAdded={showNewTask} />
        <form className="controls" role="search" aria-label="Filter tasks" onSubmit={onSubmit}>
          <label className="field">
            <span>Group</span>
            <select
              value={groupValue(shown.group)}
              // The menu shows a long name cut short, so the full name is the tooltip while it is chosen.
              title={shown.group.kind === "named" ? shown.group.name : undefined}
              onChange={(event) =>
                navigate({ group: groupFromValue(event.target.value) }, "push", text)
              }
            >
              <option value="all">All groups</option>
              {groups.map(({ name }) => (
                <option key={name} value={`g:${name}`}>
                  {truncateLabel(name, GROUP_MENU_MAX_CHARACTERS)}
                </option>
              ))}
              <option value="none">No group</option>
            </select>
          </label>
          <label className="field">
            <span>Difficulty</span>
            <select
              value={shown.difficulty ?? "all"}
              onChange={(event) =>
                navigate({ difficulty: difficultyFromValue(event.target.value) }, "push", text)
              }
            >
              <option value="all">All</option>
              <option value="low">Low</option>
              <option value="med">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="field">
            <span>Search by name</span>
            <input
              type="search"
              value={text}
              maxLength={SEARCH_MAX_LENGTH}
              autoComplete="off"
              onChange={onSearchChange}
              onCompositionEnd={onCompositionEnd}
            />
          </label>
          <a
            className="clear-filters"
            href={filterHref({ ...DEFAULT_FILTERS, view: shown.view })}
            aria-disabled={canClear ? undefined : true}
            onClick={onClearClick}
          >
            Clear filters
          </a>
        </form>
      </div>
      <nav className="views" aria-label="Stacks">
        {VIEWS.map(({ id, label }) => (
          <a
            key={id}
            className="view-link"
            href={filterHref({ ...withText, view: id })}
            aria-current={shown.view === id ? "page" : undefined}
            onClick={(event) => onViewClick(event, id)}
          >
            {label}
          </a>
        ))}
      </nav>
      {/* The stack is a new element after every change, so it cannot announce the result. */}
      <p className="visually-hidden" role="status">
        {viewLabel(filters.view)}: {count} {count === 1 ? "task" : "tasks"}
      </p>
    </div>
  );
}
