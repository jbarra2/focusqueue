# Focusqueue

A queue for one school week, for one person on this computer. It shows the one task to do now and the rest of the week in the same order. Each course is a group.

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

The focus card shows the first open task in this order:

1. Due soon: overdue, due today, or due tomorrow. Earliest due date first. On the same date, low before med before high, then the task created first.
2. Rest of this week: due after tomorrow, through Sunday. Low before med before high, then earliest due date, then the task created first.
3. If both are empty, the card says the week is clear.

Later holds open tasks due after Sunday that are not due soon. On a Sunday, a task due Monday is due soon. Later never takes the focus card.

An overdue task stays in Due soon until it is done or its due date moves.

## The page

One page, top to bottom: focus card, add form, Due soon, Rest of this week, Later, Done.

- Name, course, due date, and difficulty are required. Description may be empty.
- A task can be added, edited, deleted, marked done, and marked open again. Delete asks first.
- Postpone a task by editing its due date. There is no snooze.
- Course is free text. Suggest course names already used. There is no course table.
- Done lists tasks completed this week, most recent first.
- Every control has a visible label and works from the keyboard.

Not built yet: recurring tasks, reminders, drag-and-drop, a calendar, phone sync, accounts, and deployment. Ask before starting any of them.

## Data

One table, `task`:

- `id`: text primary key from `crypto.randomUUID()`
- `name`: text, not empty
- `course`: text, not empty
- `description`: text, empty by default
- `due_date`: calendar date as `YYYY-MM-DD`
- `difficulty`: `low`, `med`, or `high`
- `created_at`: ISO 8601 timestamp
- `completed_at`: ISO 8601 timestamp, or null while the task is open

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
- `lib/sort.test.ts` covers overdue first, difficulty order on the same date, rest-of-week order, Later never on the focus card, a Sunday with a task due Monday, and an empty week.
- Each user action is one statement or one transaction. A failed write leaves the database as it was.
- Database tests use an in-memory database, never `data/focusqueue.sqlite`.
- A refactor and a feature are separate commits.

## Build log

`LOG.md` has one numbered entry per piece of work. Each entry quotes what I asked under **Asked** and lists the results under **What came back / what changed**. The heading names the tool, such as Cursor or Claude Code. The repository is public, so keep real tasks and other private repositories out of it.

## Commits

I make every commit. Agents review, stage, and suggest the message. Do not run `git commit` or `git push` unless I ask for that commit in the same message.

Stop for a commit when the work is one change a later reader could name in a sentence, and `npm run verify` passes. Expected stops: the project skeleton, the queue order and its tests, the database, showing the queue, and each group of task actions. Do not start the next piece until I say to continue. If a piece is getting large, stop at the first part that works on its own.

At each stop:

1. Re-read the code this piece added or changed. Check that every write is validated, SQL uses placeholders, a failed write changes nothing, and no database code can reach the browser.
2. Run `npm run verify`. If it fails and you cannot fix it, stop, say what fails, and do not stage.
3. Review the uncommitted diff for mistakes, secrets, `data/`, and generated files.
4. Fix anything wrong before staging.
5. Add or update this piece's entry in `LOG.md`.
6. Stage only the files that belong in this commit, including `LOG.md`.
7. Suggest a one- or two-sentence commit message that says why.
8. Wait.

When I ask whether the work is ready to commit, do this same check and the staging in that turn. Do not only answer yes or no.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
