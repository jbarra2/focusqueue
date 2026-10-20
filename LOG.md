# Build Log

A running record of what I asked the chat AI for and what changed.

**Chat AI used:** Claude, in Claude Code inside VS Code. Entries 1 to 4 were
planned and reviewed in Cursor.

---

## 1. Stack and scope (Cursor)

**Asked:**

> I just cloned this project from GitHub and I'm encouraged to use Claude Code.
> How do I get started? Should I use the terminal or the app?

> This will be a task app. A task has a due date, name, description, and
> difficulty (low, med, high), and related tasks can be grouped. Tasks show up
> in order, easiest and closest due dates first, so I can clear them one by
> one. What tech stack do you recommend? Should it be a local app or a web app?

> Would it be a good idea to make this a Next app with a database where people
> can collaborate on tasks?

> I'll keep it a single-user web app. I came up with this to plan my own week,
> so it's mostly for personal use.

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

- Signed in to Claude Code.
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

## 13. CI (Claude Code)

**Asked:**

> Let's get started with the CI please

**What came back / what changed:**

- Added `.github/workflows/ci.yml`. On a push to `main` or `develop`, and on
  every pull request, it installs packages and runs `npm run verify` and
  `npm run build` on Ubuntu with Node 24. There is no deploy step, because the
  app only runs on this computer.
- It has read-only permissions, uses no secrets, and never uses
  `pull_request_target`, so a pull request from a fork gets no write access. The
  two actions are pinned to commit hashes, with the release name in a comment.
  There is no npm cache. Next's telemetry is turned off.
- It installs with `npm ci --ignore-scripts`. `better-sqlite3` ships a prebuilt
  Linux binary, so nothing needs compiling, and no dependency install code runs in
  CI. I checked this in a clean clone with no `data/` folder: install, `verify`
  (117 tests), and `build` all pass.
- Found while checking: a plain `npm ci` in a clean clone fails on a Windows
  machine without the C++ build tools, because npm tries to compile
  `better-sqlite3` even though the package ships binaries. CI avoids it with
  `--ignore-scripts`. Left for later: whether to make that the default for
  everyone with a project `.npmrc`, or to add a README note.
- Left out on purpose: scheduled runs, deploys, coverage services, automatic
  dependency updates, a Windows run, and any CI badge.
- `/code-review` found nothing to change. A pull request from `develop` starts
  two runs, one for the push and one for the pull request. It costs nothing on a
  public repo, so I kept the simple triggers. The first real run happens when the
  commit is pushed, and it has not run yet.
- `npm run verify` and `npm run build` pass locally.

## 14. Install without C++ build tools (Claude Code)

**Asked:**

> Which is a better option for the install problem? .npmrc or a readme note?

> Start it please

**What came back / what changed:**

- This closes the "left for later" item in entry 13. A plain `npm ci` failed on
  Windows without the C++ build tools, because npm tries to compile
  `better-sqlite3` even though the package ships prebuilt binaries.
- Compared the two fixes. A README note only helps someone who reads it before
  the install fails, so I chose a project `.npmrc` with `ignore-scripts=true`. It
  fixes the install for everyone, matches what CI already does, and runs no
  third-party install code. Named scripts such as `npm run verify` still work.
- Added `.npmrc` with a short comment on why, and how to rebuild one package by
  hand if a future dependency needs its install script. Added one line to the
  README setup step saying the scripts are off on purpose.
- Checked in a clean clone with no `data/` folder: a plain `npm ci`, `verify`
  (117 tests), `build`, and opening a SQLite database all work. The change does
  not touch the app code or the database.
- `/code-review` found nothing to change. It noted that a dependency with no
  prebuilt binary for a platform would install fine and only fail when it first
  loads, which the `.npmrc` comment now covers. The CI workflow keeps its own
  `--ignore-scripts` on purpose, so CI does not depend on this file. `AGENTS.md`
  is not part of this piece and is not staged.
- `npm run verify` passes.

## 15. The card stack (Claude Code)

**Asked:**

> Continue

> Just to confirm, the info card is not also in the center of the screen,
> correct? The info card should be displayed off to the left of the focus card,
> as its own visual card. The info card always matches whatever card has focus.

> Ok yeah tucking to the left behind the info card is fine (leave enough space
> that at least the first past card is still visible to be able to be clicked
> for traversing backward). For narrow screens where the info card is above,
> stacking to the left for past cards is still ok.

> Scrolling through multiple cards at a time feels a bit sluggish (time to
> switch from one card to the next is a tad bit slow). Another thing I noticed
> is that the description for "Sort the shed" reads "<b>not bold</b> & plain".
> Find what caused this and patch so that things like this don't happen again.
> Everything else looks great! I'm not sure if you have this planned already but
> we should handle really long descriptions by having a scrollable text box
> (once the text exceeds the bounds of the card). Also let's have the stack of
> cards centered on the screen, it currently sits above the centerline.

> I don't like that the upcoming cards look tilted, can you have them look
> straight on the stack similar to the past cards? Thanks

> I also don't like that the visible portion of each card on the stack is
> different on the past and upcoming cards. Make the right side match the left
> spacing and leave the first past card with the same amount of spacing it has
> relative to the others so that it is easier to click and see.

> Add the testing you asked for, thanks

> Do another full review of our code and design.

> Start another review again from the message I sent at 6:20pm. I want to make sure
> everything is ready and that the session limit pause didn't mess anything up.
> Afterwards stage commits and provide messages.

**What came back / what changed:**

- This is stop 3 of the UI build order. The page now shows the card stack in
  place of the sectioned list. It is read-only: there are no new writes and no
  new server code, so there was no security review.
- Layout, as clarified: the name card is the focus card, centered. One info card
  sits to its left as its own card, and its details always follow the focus
  card. Both sides of the stack are flat and mirror each other: past cards tuck
  behind the info card and upcoming cards tuck behind the focus card. The first
  card on each side sticks out 4rem so it is easy to see and click, and each
  further card shows 1.5rem more. Below 60rem the info card moves above the focus
  card, and the stack still tucks to the left and right of it.
- Up next is the only view for now: every open task in queue order (`upNext` in
  `lib/sort.ts`), so each task shows once and the old "Do now shown twice" issue
  is gone. Do now carries a "Do now" label. The filters and the Completed view
  come in the next stop. If only Later tasks exist, the page says the week is
  clear and still shows them, with no Do now label.
- `app/card-stack.tsx` is the one client component. It gets plain data and never
  imports database code. Cards are placed with CSS transforms from their distance
  to the focus card, not with native scrolling, because the focus card is wider
  than the others and a scroll row would shift as it changed. Clicking a card,
  the arrow keys, Home and End, the wheel, and Previous and Next all move the
  focus. Keys are ignored in text fields. Colors come from the group's slot
  through `data-slot`, and the group name is on the info card and the stacked
  cards. Overdue is spelled out. With reduced motion the cards do not slide.
- `lib/stack.ts` holds the pure parts (moving, keys, wheel, color slot) with
  tests. The old view and its test were removed, and the view has a new test.
- Looked at it in a clean scratch copy with a made-up database, since the real
  one is empty: rendered markup in the right order, and screenshots of the wide
  and narrow layouts, with and without past cards. Nothing was added to the real
  database.
- `/code-review` found real issues, all fixed: the wheel no longer takes over a
  long card that needs to scroll, the focus follows the task instead of its
  position (so a refreshed list does not jump), Home and End no longer take over
  page scrolling, Previous and Next stay focusable at the ends, a card reached by
  keyboard comes in front of the other stacked cards with its focus ring inside
  it, and group colors match names the way the database does (English letters
  only).
- After trying it on a scratch copy, four changes. Stepping felt slow, so the
  card slide went from 300 to 180 ms and the pause after a wheel step from 250 to
  110 ms. The description now sits in its own bordered box that scrolls by itself
  when the text is too long, with the group, due date and difficulty staying in
  view above it. It becomes a Tab stop only when it actually overflows. A very
  long name is cut to two lines on the info card, and the full name stays on the
  focus card. The page is now a full-height column, so the stack and the "week is
  clear" message are centered in the window, and the description box tint is a
  theme variable.
- The `<b>not bold</b> & plain` text was not a bug. It was in the made-up data I
  put into the scratch database to prove that task text is escaped, and I did not
  say so. The app has no code that renders HTML, so it shows text exactly as
  stored, as the rules require. Nothing needed patching, so I added a test that
  HTML-looking text shows as characters and is never made bold.
- A second `/code-review` found more issues, all fixed: the wheel now leaves the
  description box to scroll itself, a list refresh no longer resets a wheel
  gesture or moves keyboard focus, the fallback place of the focus card stays
  current when the list changes, the track is clipped so tabbing to a card that
  is partly outside it cannot shift the stack, and the "week is clear" message
  is centered above the stack too. The focus-following logic moved into
  `lib/stack.ts` with tests.
- Then the look changed. The tilt is gone on both sides, because the tilt and
  perspective made the strips look different widths even where the numbers
  matched. The upcoming cards now tuck behind the focus card, as the past cards
  do behind the info card, so the visible widths match: 4rem for the first card
  and 1.5rem for each after it. I asked first, and you chose the exact mirror. A
  strip on the right shows its card's right end, so there is no readable name
  there, only color and a click target.
- A third `/code-review` found more, all fixed: the keyboard and wheel listeners
  are now attached again when the stack appears (a page that loaded with no tasks
  would never have had them), a Tab-focused stacked card stays behind the focus
  card instead of covering it, the wheel leaves browser zoom and the sideways
  swipe at either end of the stack alone, Home and End scroll a focused
  description instead of moving the stack, the description box is measured again
  when its text changes, the focus ring on the focus card is drawn inside it, and
  the list has an explicit list role for Safari.
- Tests for the key, wheel and focus behavior. The earlier tests only covered the
  markup and the pure logic, and the reviews kept finding bugs in the parts they
  could not run. I asked before adding a dependency, and you said to add it.
  `happy-dom` is a new dev dependency, because Vitest cannot simulate a page on
  its own and nothing already in the project can. It affects only the tests, no
  app code. I chose 20.14.5 from mid-September rather than a release from the
  last few days, and the lockfile pins it. `npm audit` shows the same 7 findings
  with and without it, and none come from `happy-dom`. It is now in the stack
  list in `CLAUDE.md`.
- `app/card-stack.interaction.test.tsx` runs the stack in a simulated page, with
  49 tests for the buttons, clicking cards, the arrow, Home and End keys, the
  wheel (including zoom, the ends, the pause, and scrolling long text), the list
  changing under the focus, listeners attaching when tasks appear, the
  description and name becoming Tab stops only when they overflow, and which
  cards are Tab stops. I undid several of the fixes one at a time and each made
  a test fail.
- The new tests found a bug the old ones could not: a wheel step over the stack
  moved keyboard focus away from a field elsewhere on the page. Fixed, so focus
  moves to the new focus card only when it was lost to the page body.
- A fourth `/code-review` found more, fixed: a very long name that scrolls in the
  focus card is now reachable by keyboard, the info card is a fixed
  height so the stack does not jump when the focus changes in the narrow layout,
  the overdue color stays on cards with no group, the error page button no longer
  stretches, and a stacked card has its name as a tooltip. The tooltip does not
  fully meet the rule that every control has a visible label, because an upcoming
  strip only shows color. That follows from the look you chose, so it is open if
  you want something visible there.
- A full review by three separate reviewers (security and data, logic and the
  page, spec and process) found no critical code defects. The queue order, the
  date handling in 11 time zones, the data layer, and the security rules held.
  It did find that my fourth-round fix for cards the track cuts off could never
  fire: a card is always partly inside the track, and the observer also ignores
  cards covered by other cards. The real problem was a Tab stop on every stacked
  card, up to 12 before Previous and Next.
- The fix: the observer and its tests are removed. Only the nearest card on each
  side is a Tab stop, and the arrow keys, Home, End, the wheel and clicking still
  reach every card. Small fixes from the same review: the status line announces
  the task name for screen readers along with the position, a long unbroken group
  name wraps in the info card, Home and End are left to a focus card only when
  its long name scrolls, a mouse wheel notch counted in lines or pages (Firefox)
  is a full step with the axis chosen once, a key event that does not come from an element is ignored,
  clicking selects a card by its task and not its place in the list, and tasks
  with the same creation time sort by id. There are new sort tests for Saturday,
  Monday, a year end, a leap day, and the edges of the week for Done.
- You decided: when the week has nothing due but Later tasks exist the page says
  "The week is clear." and shows them, and with no open tasks at all it says "No
  open tasks." The Completed screen will get a Clear old completed button, which
  deletes tasks completed before this week after asking first, so old done tasks
  can no longer keep a group's color. `CLAUDE.md` now says both. The telemetry
  rule now says what is true: the app's own code makes no outside requests,
  Next's telemetry is turned off, and the Next dev server's own version check is
  the only other request.
- A final check after a pause for the usage limit found nothing half-done: every
  item from the wrap-up was in the code, the log numbers matched the tests, the
  tracked files had no personal details, and the notes for the next session were
  consistent. A last `/code-review` found four things, fixed: a 100-character
  group name could push the description box out of the info card (the group is
  now cut to two lines, and its full name is the tooltip), keyboard focus on a
  stacked card could be left on a card that slid out of view (focus now moves to
  the focus card), the observer for a scrolling box could keep a stale state when
  its element went away, and the telemetry rule overstated what one command does
  (it is a per-machine setting, so the README now has a step for a fresh clone).
- Personal account and plan details were removed from entries 1 and 3 of this
  log, and history is not rewritten. The two commits for this stop were made with
  the GitHub noreply address. You then decided that hiding the commit email is not
  necessary, so this repository uses the default commit identity again.
- The rest of the review is recorded in the project notes, in the order to take
  it: the Host-header check and anti-framing headers and a refresh of "today"
  past midnight before the first write action, structure changes for the header
  filters, a refactor that splits `app/card-stack.tsx` before done and edit,
  and tooling and documentation items. Condensing this entry is one of them.
- Left for later: the page sends every description to the browser, which a very
  long list would need to trim. The existing `npm audit` findings are mostly in
  `vitest`, where the only fix is a major upgrade to version 5.
- Left for later: touch swiping, and wheel tuning. A trackpad's momentum may move
  more than one card, and the pause is now shorter, so tell me if it skips. The
  numbers are in `app/card-stack.tsx`. With hundreds of open tasks every card is
  still a page element, which would need rendering only the nearby ones. The
  completed label and the done list are still in the code for the Completed view
  in the next stop. `AGENTS.md` is not part of this piece and is not staged.
- `npm run verify` (229 tests) and `npm run build` pass.

## 16. Move the date and group helpers (Claude Code)

**Asked:**

> Continue

**What came back / what changed:**

- Next step was the start of stop 4 (the header filters and the Completed view).
  The filters need the date helpers and the group matching in places that should
  not depend on the queue or the card stack, so this piece only moves code, in its
  own commit, and changes no behavior.
- The date helpers (`localDate`, `addDays`, `startOfWeek`, `endOfWeek`,
  `localDay`) moved from `lib/sort.ts` to a new `lib/date.ts`, with their tests in
  `lib/date.test.ts`. `lib/sort.ts` now imports what it needs from there.
- `slotFor`, and the case folding it uses, moved from `lib/stack.ts` to a new
  `lib/group.ts`, with their tests in `lib/group.test.ts`. The card stack imports
  `slotFor` from there. Entry 15 says `slotFor` is in `lib/stack.ts` and entry 9
  says the date helpers are in `lib/sort.ts`. Those entries describe the code as
  it was then, so they are unchanged.
- The moved tests came across intact: 204 test cases before and after the move,
  so none was lost. I then added two direct tests in `lib/date.test.ts`, for
  `localDate` and `localDay`, because those two had no tests of their own and
  the date helpers now have a module of their own. They pass in several time
  zones.
- `/code-review` found no defect in the move. It raised older points that stay as
  they are in this piece: a refresh of "today" past midnight (already planned
  before the first write action), the cost of looking up every card's color on
  each render, and date arithmetic on a machine whose time zone skips a calendar
  day, which only a few zones do, years from now.
- The same commit carries a one-sentence correction to entry 15, about the commit
  email you decided not to hide, which was waiting from the last session.
  `AGENTS.md` is not part of this piece and is not staged.
- `npm run verify` (231 tests) and `npm run build` pass.

## 17. Header filters and the Completed view (Claude Code)

**Asked:**

> Continue

> (answering my question about the name search) Filter as you type.

> (answering my question about the trackpad) Feels fine.

> Yes make sure that the refactor commit and all notes are ready so that when I
> get to work again in a new session, all I need to say is "Continue" and you can
> pick up where we left off. Do this while you are staging the current commit
> after we wrap things up. First I want you to do another full review for this
> work, give me a guide on what I need to check myself in a dev run, and then
> suggest a commit message after staging.

**What came back / what changed:**

- Next step was the rest of stop 4: the filters in the header, their state in the
  URL, and the Completed view. I asked two things first. You chose search that
  narrows as you type, and said the trackpad feels fine, so the wheel note is
  dropped and the wheel settings stay.
- The header now has a link for each view (Up next, Due soon, Rest of this week,
  Later, Completed), a Group menu with All groups and No group, a Difficulty
  menu, a search box labelled "Search by name", and a Clear filters link. They
  combine. Each view keeps its own order, a group matches without case like the
  database does, and the search looks only at the name, as plain text.
- Everything is in the page address, so Back, reload and a copied link all work:
  `?view=…&group=…&nogroup=1&difficulty=…&q=…`. Anything at its default is left
  out. No group has its own parameter instead of a stand-in group name, because a
  group name is free text. A value that is not valid, such as an unknown view,
  is ignored on its own and never breaks the page or resets the others.
  `lib/filter.ts` holds this as pure functions, with 48 tests. `lib/group.ts`
  gained `findGroup` and exports `foldCase`, which the group filter needs.
- The Completed view lists this week's done tasks, most recent first, and the
  info card shows the day each was completed. A done task never says Overdue, even
  if its due date passed before it was done.
- An empty stack says why. Up next says "No open tasks." when nothing is open,
  and each other view has its own sentence ("Nothing is due soon.", "No tasks
  completed this week.", and so on) when it has nothing in it. When a view has
  tasks but a filter hid them all, every view says "No tasks match these
  filters." "The week is clear." stays above the stack on Up next.
- The stack starts on the task whose id is in the address if it is in the list,
  else the Do now task, else the first card, and starts fresh whenever a filter
  changes. Nothing writes a task id into the address yet.
- The menus and view links show your choice at once while the server answers, and
  a second change before the answer builds on the first. The search is sent after
  a quarter second without typing, or at once on Enter, and replaces the history
  entry instead of adding one for each pause. A space typed at the end is kept,
  and an answer to an earlier search never overwrites what you are typing.
- Before building, a separate design review checked the plan against the Next
  docs and the code. It found things I had wrong: the generated page props type
  would not exist in CI, where the type check runs before a build, and the search
  box would drop a trailing space and could be undone by a menu change made while
  it waited. All are built in with tests. I undid the main fixes one at a time to
  see a test fail: the search-box ones, the menu change building on the last one,
  and the arrow keys from a link. Removing the cancel of a waiting search did not
  fail any test, so I added an assertion that no timer is left over.
- `/code-review` found real problems in my first version, all fixed. After a click
  on a view link the arrow keys did nothing, because focus stayed on the link; the
  left and right arrows now work from a link, and Home and End still scroll the
  page. A view change that was still loading could be undone by a menu change, so
  view links now go through the same path as the menus. Clear filters vanished
  under the keyboard and dropped focus to the page; it now stays in place and
  shows as inactive. A change of filter was not announced to screen readers, so a
  hidden status line says the view and the number of tasks. Smaller fixes: the
  views are listed once, the due label takes the task so an open check cannot be
  forgotten, the search text is trimmed the same way in the filter, the address
  and the box, and the header styles are scoped to the page header.
- Not taken from the review: the Zod schema reaches the browser through the
  address helpers (stop 5's form brings it there anyway), and one shared list of
  difficulties would touch the write schema, which belongs in its own commit.
- A full review by three separate reviewers (security and data, logic and the
  page, spec and process) found no security or data defect. The security reviewer
  tried more than thirty hostile addresses (repeated and nested parameters,
  `__proto__`, huge and malformed text, `//host` paths), found that none can
  throw, reach the error page, or produce a link that leaves the site, and found
  no database or path text in the browser files. The process reviewer found
  overstated or missing lines in this entry and stale handoff notes, both fixed.
  The logic reviewer drove the page in headless Chrome against the real router
  with a slow server and found a real bug in the search box: the answer to an
  older search could arrive just after a newer one was sent and put the old text
  back in the box for a moment. My first fix remembered every search that had been
  sent and not answered.
- That first fix was not enough, and neither was the second. Two more review
  rounds fuzz-tested the search box with thousands of random sequences of typing,
  menu changes, answers in several orders, Back and Forward, and reproduced the
  failures in real Chrome. The first showed Back leaving the box out of step with
  the page: the address was right and the stack was filtered, but the box was
  empty or kept text that was no longer in the address. That happened when Back
  left the search text unchanged, when Next dropped a navigation that was never
  answered, and when the same text had been sent twice. My second design handled
  Back with the browser's popstate event and still worked out from the props
  whether any other change of the address was the box's own. The last round showed
  that this guess still failed when the processor was busy: the check ran a moment
  after React committed, and a pause ending or a click in that moment made the box
  take an older answer. So the box no longer guesses at all. It follows the
  address only on Back and Forward, which the browser announces with popstate (a
  move to a #fragment fires it too, but with no state, and is ignored; I checked in
  real Chrome that every entry Next makes has a state). Everything else the box
  does is its own: the text stays as typed, an answer never rewrites it, and it
  remembers the search text the address has or is heading to, so text typed right
  after Back is sent even when it matches what the page showed before Back.
- Evidence for that last design. The random sequences that made the first design
  fail 12 to 22 times in every 600 now fail none: about 24,000 sequences across
  two simulations of the page, four orders of answers, React's StrictMode on and
  off, and a Back that commits at once as well as one that brings its data later.
  I left out two things on purpose: two changes inside one browser task, which a
  person cannot produce, and the data of an older Back arriving after a newer
  navigation, which Next discards (the simulation now does the same).
  In real Chrome with Next, 140 random walks of typing, menus, Back, Forward and
  reloads, with the processor slowed to a quarter, a sixth and full speed, ended
  with the box and the address agreeing every time. The one walk the checker
  flagged was most likely a normal Clear filters click that React committed more
  than a second late under the sixfold slowdown: its first action was Clear, the
  write was the empty text, and the walk ended with the box and address agreeing. The scripted cases that failed before (Back
  while a search is in flight, Back within the pause, a slow server with the same
  text sent twice, an answer arriving as the pause ends, a #fragment link while a
  search is waiting) all end correctly. I undid eleven parts of the new logic in a
  scratch copy, one at a time, and a test failed each time.
- A last reviewer tried angles nobody had: input methods, paste, undo, the native
  clear button, going Back and Forward across other sites, and a server that
  fails. It found three things. Back or Forward pressed after a reload but before
  the page had loaded its scripts left the box on the old text, because nothing
  was listening yet. The box now also reads the address once when it starts, by
  the same rule the server uses. It failed 12 times out of 12 in the development
  server before, and none of 28 runs fail now, at normal speed and at a quarter and
  a sixth of it. One earlier batch at a quarter speed did show two stale boxes
  while a heavy test of mine was running on the same machine; on a quiet machine
  the same check passed, and a timed trace showed the box correcting itself as
  soon as the page loaded. An input method that was still composing, such as Chinese or
  Japanese typing, had its half-typed letters sent after a pause; nothing is sent
  until the composition ends. The third is left, below. The rest held: the native
  clear button, Escape, paste over the limit, undo, jumps through the history and
  a failing server all behaved.
- Tests were missing for Enter not loading the page, the All difficulty choice,
  group matching with accented letters, cancelling the search when the page
  closes, and Alt-click, and they are added. I undid each of those fixes in a
  scratch copy and a test failed every time. The new search tests also cover an
  older answer arriving late, the same text sent twice, Back in each of the cases
  above, typing right after Back, and the #fragment case, and every test now fails
  if React reports a mistake with console.error. The hover on a view link was
  invisible against the page color, and now darkens the border; that one is a
  color and has no test.
- Known and left: a group used only by tasks completed before this week still
  appears in the Group menu and shows nothing, until Clear old completed exists;
  a pasted lone surrogate character is replaced when the address is read back,
  which now happens only on Back, Forward or reload; every change re-reads all tasks (5,000 tasks with long
  descriptions took about 1.4 seconds); stepping a menu with the keyboard adds one
  history entry per option; clicking the view you are already on does not send
  the stack back to Do now; `app/page.tsx` has no test of its own, so the wiring
  from the address to the page is only checked in a dev run; and the tests'
  router stand-in is only an approximation of the real router, so the Back and
  slow-server cases were also checked in real Chrome. Typing a search right after
  Back, before the data of Back's page has arrived, can bring back a filter that
  Back removed from the new address (a window of about 20 milliseconds after a
  reload, about 200 at a quarter of the speed). The box follows the
  address only on Back and Forward, so a part of the page that changes the search
  in the address by itself, such as the Add dialog in stop 5, has to reset the
  box too.
- Looked at in a scratch copy with a made-up database, at 1280 and 520 wide: every
  view, a group and search together, no matches, the Completed screen with a done
  task that is past due, and a bad address that falls back to Up next. The made-up
  data includes a task named `R&D <notes> 100% done` to check that odd characters
  are escaped in the address and on the page. Today was a Saturday, so Rest of
  this week was empty and showed its sentence.
- Left for later, on purpose: the page is still read-only. The Add a task button
  that `CLAUDE.md` puts in the header comes with stop 5, and the Clear old
  completed button on the Completed screen comes with the task actions in stop 6.
- Not tried by you yet: typing, clicking and Back in your own browser. The tests
  simulate them and a review drove headless Chrome through them, but please try
  the search box, both menus, the view links and Back.
  `AGENTS.md` is not part of this piece and is not staged.
- `npm run verify` (372 tests) and `npm run build` pass.

## 18. Hardening before the first write (Claude Code)

**Asked:**

> Continue

> What's next? I need to get this project done ASAP so extra features and perfect
> UI isn't necessary at the moment. Let's plan what we need to do to get this app
> complete. There isn't a need to have it hosted on the web yet, just provide a
> guide in the README for people to be able to get this running locally on their
> machine.

> (answering my questions) Five commit stops. One Edit form on the info card. Keep
> Clear old completed, recolor a group, the midnight refresh and the vitest
> upgrade. No LICENSE for now.

**What came back / what changed:**

- Stop 4b was committed, so the next step was a plan to finish. Six stops: this
  hardening, Add a task, Done and Clear old completed, Edit and delete, a README
  guide for running the app, and the vitest upgrade as its own commit. Anything
  that is not on that list (the refactors, the styling pass, small cleanups) is
  parked. This entry is stop 1. Nothing writes to the database yet, which is why
  this comes first.
- Only this computer may reach the app, but listening on `127.0.0.1` does not stop
  a web page on another site from reaching it: the page can point its own name at
  `127.0.0.1`, and the browser then sends that name in the Host header. `proxy.ts`
  now answers 403 unless the Host is `127.0.0.1` or `localhost`, on any port. The
  check is a pure function in `lib/host.ts`. It has no matcher, so it also covers
  static files and the page's own posts, which are how Server Functions arrive. A
  forwarded host that is not this computer is refused as well.
- `next.config.ts` forbids framing (`frame-ancestors 'none'` and
  `X-Frame-Options: DENY`), sends no referrer to other sites, and stops announcing
  the framework. I first wrote the referrer rule as `no-referrer`. The security
  review pointed out that a browser then sends `Origin: null` on a plain form post,
  which the Server Action check refuses, so it is `same-origin`: the address still
  never leaves the app.
- A name or group made only of invisible characters, such as a zero-width space,
  is now refused. Before, `trim()` let it through and the card looked blank. A few
  other blank-looking characters, such as the Braille blank, still pass, on
  purpose: it is a best-effort check and not a security boundary.
- The `data` folder is now created readable by its owner only (`ensureDataDir` in
  `lib/db.ts`). Windows ignores that mode, and a folder that already exists is not
  changed, including yours.
- A page left open overnight now refreshes itself at local midnight, and when the
  tab comes back on a later day, so Do now and Due soon never show yesterday's
  list. `msUntilMidnight` in `lib/date.ts` counts to the next local midnight and
  is tested on the 23-hour and 25-hour days of a clock change. `app/day-refresh.tsx`
  draws nothing and keeps the same card in focus.
- I started the real thing in a scratch copy with its own empty database, as a
  development server and as the production one. A request with Host `evil.example`,
  `localhost.evil.example` or `0.0.0.0` got 403, including for a static file and
  for a post that looks like a Server Function call. `127.0.0.1` and `localhost`
  got 200 with the headers on. Your own `data` folder was not touched.
- 71 tests were added. Each fix was undone one at a time to check that a test
  fails: 16 of 16 were caught, all but the folder mode, which cannot be checked
  this way on Windows. One was not caught at first (the component ignoring a new
  day), so I added the test that was missing.
- `/code-review` raised six points. One was a comment and is changed. The others
  stay as they are on purpose: a timer and a tab change can both ask for a refresh
  (harmless), the day is worked out the same way as on the page, and the strict
  403 for an odd forwarded host is the intent. `/security-review` found nothing
  at its confidence bar. It noted that the development server answers its own
  hot-reload paths before the proxy, so the proxy comment now says so. The
  production server has no such paths.
- Not checked by me: that a browser really refuses to show the app in a frame. The
  headers are on the response, but only a browser can show the block. The test of
  the folder mode is skipped on Windows and runs in CI on Linux.
  `AGENTS.md` is not part of this piece and is not staged.
- `npm run verify` (441 tests, 2 skipped on Windows) and `npm run build` pass.

## 19. Add a task (Claude Code)

**Asked:**

> There are no open tasks so I can't check that it works. Can you open a test server
> on 3100 with example tasks?

> Stop the preview server and continue with stop 2.

> (after trying it) Reorganize the filters/options so that "Add a task" is on the
> same row as search, appended to the right, and that row is above the other.
> Center the rows horizontally on the screen, slightly lower vertical position.
> Add more spacing between the "Up next", "due soon", ... buttons. Only add
> spacing for this row

> (then) What we can do for long group names is end it with ... after a certain
> amount of characters. So that the box doesn't grow and we don't have layout
> issues. Also let's put "Add a task" button on the left side of its row. And add
> spacing between the two rows. Also add a little more spacing between the buttons
> on the bottom row.

**What came back / what changed:**

- Your first request came after the hardening stop was staged. I started a copy of
  the app on port 3100 with its own database and 16 made-up tasks in three groups,
  so you could look at the queue. Your real database was not touched. You then asked
  me to stop it, and I did. This entry is stop 2 of 6, and it is the first piece that
  writes to the database from the page.
- The header has an Add a task button. It opens a dialog with a visible label on
  every field: Name, Group (optional), Due date (it starts on today), Difficulty,
  and Description (optional). The Group box suggests the groups that already exist.
  Cancel and Escape close it, and it opens blank each time.
- The group color follows from the group you type. No group shows nothing. A group
  that exists, in any letter case, shows its own color. A new group shows the grid
  of 8 colors, two columns by four rows, with the first free color already chosen.
  Each square says its color's name, and a color another group uses stays in the
  grid, disabled, drawn with a diagonal stroke and named "<color>, taken". When all
  8 are taken, a new group cannot be added: the sentence from the rules shows and
  Add is disabled.
- The write is a Server Action (`app/actions.ts`), and it is thin. The work is in
  `lib/task-actions.ts`. It refuses anything that is not the form, reads only the
  six fields it knows (so an extra field cannot set an id or mark a task done),
  checks them with Zod before the database is even opened, and saves with the
  existing `createTask`, which is one transaction. It answers with the new id or
  with one sentence. An unexpected failure is logged on the server and shown as one
  generic sentence, never SQLite's own text (`lib/action-error.ts`). After a save it
  asks Next to draw the page again. If that step fails it is logged, and the task
  still counts as added, because it is.
- After an add, the page goes to Up next with no filters and the new task in focus,
  and the search box is emptied. The box is never rewritten because of the address,
  so the add does it on purpose, and the old search text can be typed again.
- The form is sent from its own submit handler, not from a form action, because React
  clears a form's fields after a form action even when the server said no. Here a
  refusal keeps what you typed and shows its sentence in the dialog.
- The arrow keys typed in the dialog no longer move the stack behind it.
- `/code-review` raised six points. I fixed three. A failed page redraw after the
  save would have been reported as a failed add, and the form would have said
  nothing was saved. When no answer comes back at all, the sentence now says the
  task may not have been saved and to look at the list, because a lost answer can
  follow a real save. Cancel and Escape are held off while the form is being sent,
  so a refusal on its way is not lost. I left three on purpose: a file sent in the
  group field by a hand-made request means no group, the second check before the
  database opens is deliberate, and the first-free-color rule is four lines in two
  places.
- `/security-review` found nothing at its confidence bar. It checked the action's
  arguments, the SQL, error text, forged requests from another page or port
  (Next refuses an Origin of null and any other origin), markup in task text, and
  that no database code reaches the browser.
- You then asked for the header to be rearranged, in two rounds, which are part of
  this same stop because it is about where Add a task sits. The top row is now Add a
  task at its left end, then Group, Difficulty, Search by name and Clear filters.
  The view links (Up next, Due soon, and the rest) are the row under it. Both rows
  are centered on the screen and sit a little lower than the title. The two rows
  are 24 px apart (12 px before), and the view links are 28 px apart (8 px before).
  Only the view links got wider gaps, and the top row's own gaps are unchanged. The
  page order matches the screen, so Tab goes Add a task, Group, Difficulty, Search,
  Clear filters, then the view links. Below 70rem (1120 px) the title moves to a row
  of its own, so the top row keeps the whole width and stays on one line down to a
  narrow window. On a phone-sized window it has to wrap.
- A long group name no longer widens the Group menu. The menu shows a name longer
  than 20 characters cut short and ending with an ellipsis, such as "Quarterly
  planning…", and the space before the cut is dropped. An emoji or a letter with an
  accent is never split. The option still holds the whole name, so choosing it
  filters by the whole group, and while that group is chosen the whole name is the
  menu's tooltip. The Add dialog still suggests the whole name. Two different names
  that start with the same 19 characters would look the same in the menu. That is
  rare, and it is on the later list.
- I checked 1280, 1130, 1000 and 520 px wide in headless Chrome, with a made-up
  80-character group name added: the rows are centered to the pixel, the Group menu
  stays 164 px wide, the gaps are as above, and the dialog still opens from its new
  place. I looked at the screenshots.
- 120 tests were added. Each fix was undone one at a time to check that a test
  fails: 46 of 46 were caught. One was not at first (reading the color with
  `Number()` accepted `0x3`), so I added the missing cases.
- I also ran the real thing in headless Chrome against a copy of the production
  build with made-up data: 21 checks passed. The dialog opens with the name field
  focused. The grid has two columns, with the three used colors marked taken. An
  add succeeds and the request carries a real Origin. The new task is the focus
  card, on its group's new color, and the list says 14 tasks. After Back, the older
  page also says 14, not a stale 13. A refusal keeps the typed text. Escape closes
  the dialog, focus goes back to the button, and the next opening is blank. I
  looked at the screenshots too.
- Not done, on purpose: marking a task done, editing and deleting come in later
  stops, and so does the overall look of the page (colors, shadows, spacing), which
  you now want done properly. A task whose answer was lost can still be added twice
  if you retry, so the sentence tells you to check the list first.
  I have not tried it in your own browser, so please do.
  `AGENTS.md` is not part of this piece and is not staged.
- `npm run verify` (561 tests, 2 skipped on Windows) and `npm run build` pass.

## 20. Split the card stack (Claude Code)

**Asked:**

> Continue and also find out why two tests are skipped on verify runs.

**What came back / what changed:**

- This is a refactor and nothing else: the card stack does exactly what it did, in
  smaller files, before Done, Edit and Delete make it bigger. `app/card-stack.tsx`
  went from 386 lines to 188 and keeps the focus (by task, not by place), the
  layout, and the Previous and Next buttons. Five files now sit beside it:
  `info-card.tsx` (the details card and its description box), `name-card.tsx` (the
  focus card), `stacked-card.tsx` (a card behind or ahead of it),
  `use-stack-input.ts` (the arrow keys and the wheel) and `use-measure.ts` (the
  check for text that does not fit). The wheel's two timing numbers are now in
  `use-stack-input.ts`, so entry 15's "the numbers are in `app/card-stack.tsx`" is out
  of date. The markup, class names and ids are unchanged. The details card is still
  not keyed by task, and the focus card is still a plain article.
- The page looks and behaves the same, and I checked that in a real browser rather
  than by reading the code. I built the old code and the new code in a scratch copy
  with made-up tasks and drove headless Chrome through each one at 1280 and 520 px
  wide: first load, the right arrow twice, End, and the Completed view. For each of
  those 8 states I saved a screenshot of the whole page, the page markup, and which
  element had keyboard focus. All 24 files from the old and the new code are
  identical to the byte.
- `/code-review` raised 10 points. One was real. I had moved the check for a very
  long name into the focus card, which is a new element on every move, so each move
  drew the card for a moment as if it were not a tab stop and then corrected it. The
  finished page looked the same, which is why the screenshots matched, but it was a
  change, so the check is back in the stack, where it was before. A new test fails
  with the old arrangement (it saw the correction) and passes now. Two small things
  were also fixed: the key and wheel hook now takes only the moves it sends, and the
  two things it relies on from the stack (the refs it keeps current, and why it is
  told whether the stack exists) are written in its comments. I left the other
  points on purpose. Three copies of the difficulty labels are stop B. Working out
  each card's group color on every render is stop C. The cards drawing again on every
  move, and the fixed ids such as `info-title`, are the same as before this split.
  The heading in `AGENTS.md` is not part of this piece and is not staged.
- You asked why two tests are skipped. They are the two folder-mode tests in
  `lib/db.test.ts`. They check that the `data` folder is created readable by its
  owner only, and that a folder that already exists keeps its mode. Windows has no
  owner-only folder modes, so on Windows they would check nothing, and they are
  skipped on purpose. On Linux they run, so the CI run for the last commit shows 563
  passed and none skipped. You chose to leave it there, with no note in the README.
- One test was added, the one above. No other test changed, and all of them pass.
- `npm run verify` (562 tests, 2 skipped on Windows) and `npm run build` pass.

## 21. Define the difficulty list and the slot colors once (Claude Code)

**Asked:**

> Continue

**What came back / what changed:**

- Another refactor and nothing else: the app looks and behaves the same, in its own
  commit. It is done now so that Done, Edit and Delete can use one list and one rule
  instead of copying them again.
- The difficulties are written once. The list `low, med, high`, with the names shown
  on screen (Low, Medium, High), is now in `lib/task.ts`. Before, it was written out
  separately in the task type, the task schema, the filter that reads the address,
  the sort order, the header's Difficulty menu, the Add dialog and the info card.
  All of them read the list now, and its order is the sort order. One copy is left
  on purpose: the database's own check inside a migration, because a committed
  migration is never edited. A new test reads that check from a migrated database
  and fails if it and the list ever differ, so adding a fourth difficulty means
  adding a migration for it.
- The 8 group colors are written once. Each slot now sets two style variables
  (`--slot-bg` and `--slot-ink`), and the cards, the squares in the color grid and
  the chip next to a group all read them in one shared rule. That replaced 16 rules,
  eight for the cards and eight shared by the squares and the chip, each naming the
  slot's colors again. The shared rule sets `background-color` and not the
  `background` shorthand, because the diagonal stripes on a taken color are a
  background image, and the shorthand would wipe them.
- The info card's width has its own variable now (`--info-w`), the same as the card
  width for the time being. The wide layout (where the info card sits, and where the
  first card behind it starts) is worked out from it, so nothing changes on screen.
  It is there so the Edit stop can make that card wider without touching the maths
  of the stack.
- I checked the page in a real browser, not by reading the code. I built the old
  code and the new code in a scratch copy with made-up tasks and drove headless
  Chrome through each one at 1280 and 520 px wide. There were seven states: first
  load, the right arrow twice, End, the Completed view, the Add dialog open, the
  dialog with a new group typed (so the color grid shows, with its three taken colors
  striped), and the dialog with an existing group typed (so the color chip shows).
  For each I saved a screenshot of the whole page, the page markup, and which element
  had keyboard focus. All 42 files from the old and the new code are identical to the
  byte. I ran it a second time after the review fixes below, on the final code.
- `/code-review` raised 9 points. I fixed six. The new theme test read the style
  sheet badly: it misread the first rule inside every `@media` block and looked only
  at the first rule it found, so a repeated or overriding rule would have gone
  unseen. Now every rule is read, each slot and each of the three shared selectors
  must appear exactly once, and the check that no other rule names a group color
  lists the selectors that do, instead of counting. The comment on `--info-w` said
  the stack would not move when the card grows, which is wrong (the cards behind it
  move on purpose), so it now says what it does. The sort rank went back to a lookup
  table, built from the list, so the sort code reads as it did. The migration test
  reuses one database instead of opening four. The two new difficulty tests said
  more than they checked, so their names were corrected. I left three on purpose. A
  slot outside 1 to 8 would lose the card's base colors, but it cannot happen: the
  database refuses it, the task schema refuses it, and the theme test needs a rule
  for every slot. The review also wanted this split into two commits, but one commit
  is the plan you approved. And it suggested one shared "is this a difficulty" check
  for the menu, the address and the add action: the menu and the address do different
  jobs, and the cast in the add action only changes a type, because the schema does
  the checking. `AGENTS.md` is not part of this piece and is not staged.
- Seven tests were added in all, and the old test for the swatch rules was replaced
  by new theme tests for the single rule. I undid the work one piece at a time to
  check that a test fails: a fourth difficulty added, the list reversed, one slot
  pointing at another slot's text color, the chip dropped from the shared rule, the
  `background` shorthand put back, a slot color written again, the shared rule
  repeated inside a media query, and a slot's variable overridden later. 8 of 8 were
  caught.
- `npm run verify` (569 tests, 2 skipped on Windows) and `npm run build` pass.
