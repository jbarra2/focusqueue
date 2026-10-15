# Focusqueue

A queue for one week, for one person on this computer. It shows the one task to do now and the rest of the week in the same order. Tasks can be sorted into groups, each with its own color.

Security and stability come before the next feature. The GitHub repository is public.

## Stack

- One Next.js App Router app at the repository root, with React and TypeScript, on Node 24
- Plain CSS in `app/globals.css`, with colors as variables in `:root`
- SQLite through `better-sqlite3`, in `data/focusqueue.sqlite`
- Zod for every write
- ESLint, Prettier, and Vitest

Do not add Express, Prisma or another ORM, Postgres, Docker, authentication, OpenAPI, npm workspaces, or a UI or state library. Ask before adding any other dependency, and say why an existing one will not do.

TypeScript 7 is the compiler. `typescript-eslint` does not support it yet, so ESLint parses TypeScript with Babel. `npm run typecheck` is the type gate. Do not downgrade TypeScript to make a lint tool start.

`npm run verify` runs typecheck, lint, format check, and tests.

## The queue

The week runs Monday through Sunday in local time.

Do now is the first open task in this order:

1. Due soon: overdue, due today, or due tomorrow. Earliest due date first. On the same date, low before med before high, then the task created first.
2. Rest of this week: due after tomorrow, through Sunday. Low before med before high, then earliest due date, then the task created first.
3. If both are empty, the page says the week is clear.

Later holds open tasks due after Sunday that are not due soon. On a Sunday, a task due Monday is due soon. Later is never Do now.

An overdue task stays in Due soon until it is done or its due date moves.

## The page

One page: a header line, then the card stack.

- The header holds the title, the stack filters, and an Add a task button.
- The stack shows one current card in the center. The rest of the stack follows behind it to the right, in order. Clicking a stacked card, scrolling, or the arrow keys makes it current.
- The current card shows as two cards side by side. The name card marks the task done when selected, after asking first. The info card shows group, due date, difficulty, and description, edits each one in place, and has Delete.
- The page opens on Up next with the Do now task current. If no task is open, it says the week is clear.
- Filters: Up next (every open task in queue order), Due soon, Rest of this week, Later, and Completed; one group or No group; one difficulty; search by name. They combine.
- Completed lists tasks completed this week, most recent first. A done task leaves every other stack.
- Name, due date, and difficulty are required. Group and description may be empty.
- A task can be added, edited, deleted, marked done, and marked open again. Delete asks first.
- Postpone a task by editing its due date. There is no snooze.
- Group is free text and optional. Suggest group names already used. A task with no group uses the theme's base card colors.
- Each group has one of the theme's 8 group colors. The base colors are never group colors. The color is picked from a grid of 8 squares, two columns by four rows, when the group is first used, and can be changed from the info card. Two groups never share a color, so a color in use shows as taken.
- When all 8 colors are taken, a new group cannot be added. Say so in one sentence: leave the group empty, choose an existing group, or delete an old group's tasks to free its color.
- Wording and design stay general. The app is not tied to school or any one field.
- Every control has a visible label and works from the keyboard. Motion respects reduced-motion settings.

Not built yet: recurring tasks, reminders, drag-and-drop, a calendar, phone sync, accounts, deployment, switching color themes, and renaming or removing groups. Ask before starting any of them.

## Data

Two tables.

`task`:

- `id`: text primary key from `crypto.randomUUID()`
- `name`: text, not empty
- `group_name`: text naming a row in `task_group`, or null when the task has no group
- `description`: text, empty by default
- `due_date`: calendar date as `YYYY-MM-DD`
- `difficulty`: `low`, `med`, or `high`
- `created_at`: ISO 8601 timestamp
- `completed_at`: ISO 8601 timestamp, or null while the task is open

`task_group`:

- `name`: text primary key, compared without case, not empty
- `color`: integer slot from 1 to 8, unique, so no two groups share a color

A group exists while at least one task, open or done, uses it. The transaction that removes or moves a group's last task also deletes the group, which frees its color.

Colors belong to themes. A group stores a slot number, never a color value. Each theme defines its base colors and all 8 group slots as CSS variables in `app/globals.css`, so a chosen color stays on theme when the theme changes.

A task is open while `completed_at` is null. Marking it done sets `completed_at`, and marking it open clears it. Enforce difficulty, non-empty text, and the date format with CHECK constraints as well as Zod.

A due date is a calendar day, not an instant. Compare `YYYY-MM-DD` strings, or build a local date from the year, month, and day. Never use `new Date("YYYY-MM-DD")`, which reads the string as UTC midnight and can shift the day.

Schema changes are migrations: an ordered list in `lib/migrations.ts`, applied at startup inside a transaction and tracked with `PRAGMA user_version`. Never edit a committed migration. Add a new one.

## Security

There is no login, so only this computer may reach the app.

- `dev` and `start` listen on `127.0.0.1`, never on every network interface.
- Database code lives in `lib/db.ts` and `lib/tasks.ts`, and both import `server-only`. The browser never receives the database path, SQL, or a stack trace.
- SQL uses prepared statements with `?` placeholders. Never build SQL from input. The database path is a constant.
- Every server action parses its input with Zod before the database is touched. Checks in the browser only produce messages.
- An expected failure returns one sentence the user can act on. Log the details on the server.
- Render task text as plain text. No `dangerouslySetInnerHTML` and no Markdown rendering.
- `data/` stays out of git. Test data is made up, never copied from the real database.
- No network calls, analytics, or telemetry.

## Stability

- The queue order lives in `lib/sort.ts` as pure functions that take today's date as an argument. They never read the clock.
- `lib/sort.test.ts` covers overdue first, difficulty order on the same date, rest-of-week order, Later never Do now, a Sunday with a task due Monday, and an empty week.
- Each user action is one statement or one transaction. A failed write leaves the database as it was.
- Database tests use an in-memory database, never `data/focusqueue.sqlite`.
- A refactor and a feature are separate commits.

## Build log

`LOG.md` has one numbered entry per piece of work. Each entry quotes what I asked under **Asked** and lists the results under **What came back / what changed**. The heading names the tool, such as Claude Code. The repository is public, so keep real tasks, other private repositories, and personal details such as accounts, plans, emails, and local paths out of every file, including `LOG.md`, `CLAUDE.md`, and commit messages.

## Commits

I make every commit. Agents review, stage, and suggest the message. Do not run `git commit` or `git push` unless I ask for that commit in the same message.

Stop for a commit when the work is one change a later reader could name in a sentence, and `npm run verify` passes. Expected stops: the project skeleton, the queue order and its tests, the database, showing the queue, and each group of task actions. Do not start the next piece until I say to continue. If a piece is getting large, stop at the first part that works on its own.

At each stop:

1. Re-read the code this piece added or changed. Check that every write is validated, SQL uses placeholders, a failed write changes nothing, and no database code can reach the browser.
2. Run `npm run verify`. If it fails and you cannot fix it, stop, say what fails, and do not stage.
3. Review the uncommitted diff for mistakes, secrets, `data/`, and generated files. Run `/code-review` on it. For the database and task-action pieces, also run `/security-review`.
4. Fix anything wrong before staging.
5. Add or update this piece's entry in `LOG.md`.
6. Stage only the files that belong in this commit, including `LOG.md`.
7. Suggest a one- or two-sentence commit message that says why.
8. Wait.

When I ask whether the work is ready to commit, do this same check and the staging in that turn. Do not only answer yes or no.

@AGENTS.md
