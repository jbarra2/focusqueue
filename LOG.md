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
