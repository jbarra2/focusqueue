# Build Log

A running record of what I asked the chat AI for and what changed.

**Chat AI used:** Claude, in Claude Code inside VS Code. Entries 1 to 4 were
planned and reviewed in Cursor.

---

## 1. Stack and scope (Cursor)

**Asked:**

> I just cloned this project from GitHub. I got a Claude Pro subscription from
> school and I'm encouraged to use Claude Code. How do I get started? Should I
> use the terminal or the app?

> This will be a task app. A task has a due date, name, description, and
> difficulty (low, med, high), and related tasks can be grouped. Tasks show up
> in order, easiest and closest due dates first, so I can clear them one by
> one. What tech stack do you recommend? Should it be a local app or a web app?

> Would it be a good idea to make this a Next app with a database where people
> can collaborate on tasks?

> I'll keep it a single-user web app. I came up with this to plan my school
> week as a CS student, so it's mostly for personal use.

> I want the same tech stack as my other project, since I know it, but I don't
> think this app needs everything that project uses.

> Let's use SQLite so the data persists.

> What other planning should we do before we start with Claude?

**What came back / what changed:**

- Single-user web app first. Collaboration waits until the queue is useful to
  me.
- Each course is a group. The home screen is this week, with the one task to
  do now at the top.
- Order: overdue and due today or tomorrow come first, soonest first. The rest
  of the week goes easiest first. Anything due after Sunday waits under Later.
- Stack: one Next.js app with React, TypeScript, plain CSS, Zod, ESLint,
  Prettier, and Vitest, the same as my other project. Left out its API server,
  Postgres, Prisma, Docker, sign-in, OpenAPI, and workspaces.
- Tasks live in one SQLite file on this computer, `data/focusqueue.sqlite`,
  kept out of git.
- First version: add, edit, delete, mark done, and undo. Recurring tasks,
  reminders, a calendar, and phone sync wait until I've used it for a week.

## 2. Project rules (Cursor)

**Asked:**

> Security and stability are the top priorities. Should I write skills for
> Claude? Are there skills for Cursor as well?

> Do everything that needs to be done on the Cursor side, then tell me step by
> step what to do in Claude Code. Don't run any Claude Code commands yourself.
> Pause our work at the right times so I can make thoughtful commits, and make
> that a project rule too.

**What came back / what changed:**

- Skipped skills for now. They're for workflows I repeat, and there aren't any
  yet.
- Added `AGENTS.md` with the queue order, the page, the `task` table, and the
  security, stability, and commit rules. Cursor reads it directly, and
  `CLAUDE.md` imports it for Claude Code.
- Commit rule: agents never commit or push. After each piece they review the
  code, run `npm run verify`, stage only what belongs, suggest a message, and
  wait for me.
- Security rules: the app listens only on `127.0.0.1` because there is no
  login, SQL uses placeholders, the server checks every write with Zod, and
  task text renders as plain text.
- Picked `better-sqlite3` over Node's built-in `node:sqlite`, which Node 24
  still marks experimental and warns about on every start.
- Added `.gitignore` to keep `data/` out of this public repo, and
  `.gitattributes` to keep line endings LF on Windows.
- Got a step-by-step Claude Code plan: one prompt per piece, each ending at a
  commit.

## 3. Claude Code setup (Cursor)

**Asked:**

> What model should I use with Claude Code?

> Remind me when I need to switch to high effort and back as we get to those
> parts. Why do we host on 127.0.0.1 and not localhost:3000?

**What came back / what changed:**

- Signed in to Claude Code with my school account. It's a Claude Team plan,
  not Pro.
- Model: `opusplan`, which plans with Opus and writes code with Sonnet. The
  database and the task actions run on Opus at high effort for the whole
  session, because a mistake there is a security bug.
- The port is 3000 either way. `127.0.0.1` keeps the app off the Wi-Fi, and
  the number avoids `localhost` resolving to IPv6 on Windows.

## 4. Project skeleton (Claude Code, reviewed in Cursor)

**Asked:**

> Set up the project skeleton only. Match versions and tool settings from my
> other project, without editing it. No database, sorting, or task code yet.
> Run `npm install` and `npm run verify`, then stop at the commit checkpoint.

> Review Claude's work and what's staged, confirm everything looks good, and
> suggest a commit message.

> How do I fix the typo in the previous commit? Is it OK to include the IP in
> the message?

**What came back / what changed:**

- Claude Code added the Next.js app at the repo root with a placeholder page,
  the `dev`, `build`, `start`, `typecheck`, `lint`, `format`, `test`, and
  `verify` scripts, TypeScript 7, ESLint, Prettier, Vitest, `.nvmrc`, and
  setup steps in the README.
- `dev` and `start` listen on `127.0.0.1:3000`. `npm run verify` passed and
  the page loaded.
- Review: every package comes from the npm registry, and nothing beyond the
  skeleton was added. Staged the dev-server version of `next-env.d.ts`, since
  Next rewrites it differently for `dev` and `build`.
- Left for later: `@types/node` is version 26 while the app runs on Node 24.
- Fixed the typo in the previous commit message with
  `git commit --amend --only` and `git push --force-with-lease`.
- `127.0.0.1` is fine in a public commit. It means "this computer" on every
  machine.

## 5. Move to VS Code (Claude Code)

**Asked:**

> I am moving away from Cursor and into a VS Code + Claude Code development
> environment. How should we move on?

> Fold Cursor rules into Claude Code. We can also fold AGENTS.md into
> CLAUDE.md. Let me know if this is or isn't a sensible thing to do.

**What came back / what changed:**

- There were no committed Cursor rules to fold in. Removed the `.cursor` lines
  from `.gitignore`.
- Moved the project rules from `AGENTS.md` into `CLAUDE.md`. `AGENTS.md` now
  holds only the block that `next dev` writes and re-adds, so Next can keep
  updating it without touching my rules. `CLAUDE.md` still imports it.
- Folding everything into `CLAUDE.md` and deleting `AGENTS.md` was not
  sensible: `next dev` would recreate the file on every start.
- The commit-stop review now runs `/code-review`, and `/security-review` for
  the database and task-action pieces. This replaces the Cursor review.
- Added `.vscode/extensions.json` and `.vscode/settings.json`: Prettier on
  save, and the editor uses the project's TypeScript 7.
- Nothing in the repository depends on which Claude account is signed in, so
  changing accounts later needs only `/login`.

## 6. Queue order (Claude Code)

**Asked:**

> Review the project. What is the next step in development?

**What came back / what changed:**

- Next step was the queue order and its tests, since it needs no database and
  the database and page will build on it.
- Added `lib/task.ts` (the `Task` type), `lib/sort.ts` (pure functions that take
  today's date as an argument and never read the clock), and `lib/sort.test.ts`.
- Due dates are compared as `YYYY-MM-DD` strings, and day math builds a local
  date from year, month, and day, so no date is read as UTC.
- Tests cover overdue first, difficulty order on the same date, rest-of-week
  order, Later never on the focus card, a Sunday with a task due Monday, an
  empty week, the created-first tiebreak, month and year boundaries, and Done.
- `npm run verify` passes.

## 7. Fix a stale pointer (Claude Code)

**Asked:**

> Ok the commit is done, let's fix the last bit you mentioned and stage another
> small commit

**What came back / what changed:**

- The comment above the parser in `eslint.config.mjs` said "See AGENTS.md".
  Entry 5 moved the TypeScript 7 rule into `CLAUDE.md`, so the comment now
  points there.
- Nothing else referred to the old location. `CLAUDE.md` still imports
  `AGENTS.md` on purpose.

## 8. The database (Claude Code)

**Asked:**

> Let's get started with the next step in development

**What came back / what changed:**

- Worked on Opus at high effort, as planned in entry 3.
- Added `better-sqlite3` and its types (`@types/better-sqlite3`). I did not add
  `server-only`: Next handles that import itself, and Vitest points it at an
  empty stub.
- `lib/migrations.ts` holds the ordered migrations and applies them in one
  immediate transaction tracked by `PRAGMA user_version`. Migration 1 creates
  the `task` table with CHECK constraints for text, date, and difficulty.
- `lib/db.ts` opens the one connection at `data/focusqueue.sqlite`. `lib/tasks.ts`
  has the list, create, edit, delete, done, and open functions, each parsing
  with Zod (`lib/task-schema.ts`) before one prepared statement.
- Tests use an in-memory database only, and cover CHECK constraints that bypass
  Zod, invalid input writing nothing, and SQL-looking text stored as text.
- `/code-review` found a migration race and a leaked handle on a failed
  migration. Both are fixed. `/security-review` found nothing.
- Left for later: the database path comes from the working directory, so
  starting the server from another folder would make a new empty database.
  Course suggestions are case-sensitive, so "Physics" and "physics" are two.
- `npm run verify` and `npm run build` pass.

## 9. Showing the queue (Claude Code)

**Asked:**

> What's next?

**What came back / what changed:**

- Next step was showing the queue on the page. It is read-only: the add form
  and the task actions are the next stops, so this piece has no client code
  apart from the error page.
- `app/page.tsx` reads every task, builds the queue for today with `buildQueue`,
  and renders it with `app/queue-view.tsx` and `app/task-item.tsx`: the focus
  card, Due soon, Rest of this week, Later, and Done. It calls `connection()`
  first, because `better-sqlite3` is synchronous and the page would otherwise be
  built once at `next build`. The build now marks `/` as dynamic.
- `lib/format.ts` makes the due labels (Overdue with the date, Today, Tomorrow,
  or the date) and the Done label. They take today's date as an argument.
- `app/error.tsx` shows one sentence and a Try again button. It never shows the
  error message or stack.
- Task text is rendered as plain text. A test checks that a task named like a
  script tag comes out escaped.
- `/code-review` found that `localDate` read years 0 to 99 as 1900 to 1999, and
  the schema accepts those dates. Fixed in `lib/sort.ts` with a test. It also
  caught a `completedLabel` test that depended on the time zone, and a missing
  Done test. Both are fixed.
- Left for later: the focus task also appears at the top of its own list, which
  may need a cue or an exclusion once the task actions add buttons. The database
  path still comes from the working directory, and course suggestions are still
  case-sensitive. `next dev` changed a heading level in `AGENTS.md`. That is
  not part of this piece and is not staged.
- `npm run verify` and `npm run build` pass.

## 10. UI design and a general-purpose scope (Claude Code)

**Asked:**

> Let's start planning the UI design

> For the design and theme, I want the task cards to be organized in a fashion
> similar to scrolling through albums on a music app. So the current focus card
> is in the center of the screen, while later cards follow behind it stacked to
> the right. The card in focus should display the two cards, and clicking or
> scrolling to another card on the stack puts that card in focus. By focus I
> mean which card takes the screen at any given time, not which task should be
> handled immediately. I also want to have different options in a header line,
> allowing to filter a stack of cards in different ways to form different
> visual lists.

> We should plan to create different color themes, with dedicated colors to
> assign to groups per theme, so that chosen colors stay on theme. For this
> reason we may only have a limited amount of groups available to the user,
> that is ok, just be sure to communicate that to the user if they reach the
> group limit. We don't have to have the changing themes as a feature yet,
> simply plan around this since it will be implemented in the future.

> The base theme colors should not be part of the swatch table. The swatch
> table for group colors should contain exactly 8 different colors (displayed
> in little squares filled with those colors, two columns and four rows) that
> the user can choose from. Cards not pertaining to a group (default) will keep
> the base colors from the chosen theme.

> I should also mention, I want this app to remain generalized for all
> purposes. My example of using it for school pertains to my own experience,
> but the idea is that this can be used by different people in different
> fields. So you don't need to use terminology or design specifically for
> school.

**What came back / what changed:**

- No code changed. This was planning, and the rules moved into `CLAUDE.md` and
  `README.md` before any of it is built.
- Decisions: the page is a card stack with one current card in the center. The
  current card shows as two cards, a name card that asks before marking the task
  done and an info card with click-to-edit fields and Delete. Do now is the
  queue's pick and the page opens on it. A header line filters the stack by
  queue section, group, difficulty, and name, and a task done this week moves to
  Completed.
- "Course" becomes "group" everywhere, and a group is optional. A task with no
  group uses the theme's base card colors. Each group has one of 8 theme colors,
  picked from a grid of 8 squares (two columns, four rows) that never includes
  the base colors. When all 8 are taken, a new group is refused with one
  sentence. A group frees its color when its last task is gone.
- Colors belong to themes. A group stores a slot number, never a color value, so
  a chosen color stays on theme when themes are added later. Only the warm theme
  exists for now.
- `CLAUDE.md` now describes the new page, the `task_group` table, and the
  general-purpose rule. "Focus card" became "Do now", and the not-built-yet list
  gained theme switching and renaming or removing groups. `README.md` has the
  same neutral opening line.
- The code still uses `course` and the old page. The build order is eight
  commit stops. The first is a rename-only refactor from course to group. The
  last is a styling pass, kept separate from the features.
- Left for later: renaming `Queue.focus` to `doNow`, which can go in the rename
  refactor. `next dev` also changed a heading level in `AGENTS.md`. That is not
  part of this piece and is not staged.
- `npm run verify` passes.

## 11. Rename course to group (Claude Code)

**Asked:**

> Continue

**What came back / what changed:**

- Next step was stop 1 of the UI build order: a refactor with no change in
  behavior, so the optional-group work starts from the general names. A group
  is still required in this piece.
- Migration 2 renames the `course` column to `group_name`
  (`ALTER TABLE task RENAME COLUMN`). Migration 1 is untouched, and the column
  keeps its NOT NULL and non-empty CHECK. A new test builds a version 1
  database with a row, migrates it, and checks that the row survives under the
  new name and that a blank group is still rejected.
- `Task.course` became `Task.group`, the Zod field and its messages say
  "group", and `listCourses` became `listGroups`. SQL still uses `?`
  placeholders only.
- `Queue.focus` became `Queue.doNow`, matching the Do now term in the rules.
  The `focus-card` class and `focus-heading` id stay for now, because the stack
  view replaces that markup.
- The page description and `package.json` description no longer say "school".
  Test data is neutral: made-up chores, reports, and groups like "Home".
- `/code-review` found nothing to fix here. It flagged three things that belong
  to the next piece: group is still required, there is no `task_group` table
  yet, and group suggestions are still case-sensitive. The next stop covers all
  three. It also flagged the `AGENTS.md` heading that `next dev` rewrites. That
  is not part of this piece and is not staged.
- `npm run verify` and `npm run build` pass. The build rewrote `next-env.d.ts`
  to its build-time form, so I restored the committed dev-server version.

## 12. Optional groups and color slots (Claude Code)

**Asked:**

> Let's get started with the next step please

**What came back / what changed:**

- Worked on Opus at high effort, as planned in entry 3. This is stop 2 of the UI
  build order: the data layer and the theme colors, with no new screen. The
  stack view, the add dialog, and the swatch grid build on it later.
- Migration 3 creates `task_group` (a name compared without case, and a color
  slot from 1 to 8 that no other group can share). It then rebuilds `task` so
  `group_name` is optional and must name a group. Existing groups are moved in
  with one row per name ignoring case, keeping the first spelling used, and
  colors 1 to 8 in order of first use. It stops with a clear sentence if a
  database has more than 8 groups, and it checks the task count and the foreign
  keys before it finishes. A migration can now be a function as well as SQL.
- A group is optional. Empty text means no group, and such a task uses the
  theme's base card colors.
- Each write is one transaction. Creating a task in a new group adds the group
  and the task. Editing or deleting a task removes its old group if no task uses
  it, which frees the color. Moving the last task of a group to a new group frees
  the old color first, so it works even when all 8 colors are taken. A ninth group
  and a color already taken are refused with one fixed sentence (`GroupError`).
  `setGroupColor` recolors one group. `listGroups` now reads from `task_group`,
  so "Garden" and "garden" are one group and suggestions are no longer
  case-sensitive.
- `lib/theme.ts` holds the 8-color count and the color names. `app/globals.css`
  now has one block for the warm theme, with the base colors, the card colors,
  and `--group-1` to `--group-8` with matching text colors. `app/layout.tsx` sets
  `data-theme`. A test reads the CSS and checks 8 different colors, none equal to
  a base color, and AA contrast.
- `/code-review` found nothing that breaks the rules. I fixed two things: the
  limit sentence now uses the color count instead of a typed 8, and the default
  theme is also set on `:root`, so a page without `data-theme` still has colors.
  `/security-review` found nothing. Server actions must catch `GroupError` and
  the Zod error and return the sentence when they are added in the add-a-task
  stop.
- The match ignoring case covers plain English letters only, because that is how
  SQLite compares text. "É" and "é" would be two groups.
- Backed up the local database into `data/`, which is not in git, before the
  migration runs on it. `npm run verify` and `npm run build` pass.
