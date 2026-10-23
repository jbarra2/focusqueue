# Focusqueue

A queue for one week, for one person on this computer. It shows the one task to do now and the rest of the week in the same order. Tasks can be sorted into groups, each with its own color.

The app listens on `127.0.0.1` only. There is no login, so only this computer can reach it. Task data lives in `data/`, which is not in git.

## Run it on your computer

You need Git and Node.js 24. Check with `node --version`. With nvm, `nvm use` in the project folder picks the right version.

1. Get the code. Run `git clone` with the repository's address (the Code button on its GitHub page), then `cd focusqueue`. Run every command below from this folder, because the app keeps its data in the `data/` folder of the folder it starts from.
2. Install the packages: `npm ci`. It installs exactly the versions in `package-lock.json` and does not change that file. You do not need C++ build tools: `better-sqlite3` ships ready-made files for Windows, macOS, and Linux, and `.npmrc` turns dependency install scripts off on purpose.
3. Turn off Next.js telemetry on this computer, once: `npx next telemetry disable`
4. Build the app: `npm run build`
5. Start it: `npm start`, then open <http://127.0.0.1:3000> or <http://localhost:3000>. A request under any other name, such as this computer's network name, gets a Forbidden page on purpose.
6. Stop it with Ctrl+C. The next time, only step 5 is needed.

### Your data

The first page you open creates the `data/` folder and `data/focusqueue.sqlite`. Git never sees `data/`.

- **Back up:** stop the app, then copy the whole `data` folder. Recent changes can sit in `focusqueue.sqlite-wal` next to the database, so copying only the `.sqlite` file can lose them.
- **Restore:** stop the app, delete `data`, and put the copy in its place.
- **Start over:** stop the app and delete `data`.

### Update to a newer version

Stop the app and back up `data` first. Then run `git pull`, `npm ci`, `npm run build`, and `npm start`. Building the app rewrites `next-env.d.ts`, which git tracks. If `git pull` stops over it, run `git checkout next-env.d.ts` and pull again. A newer version upgrades the database the first time it opens it, in one step that either finishes or changes nothing. An older version will not open a database that a newer one has upgraded, so keep the backup.

### If something goes wrong

- **"address already in use":** another program has port 3000. Close it, or start this app on another port with `npx next start -H 127.0.0.1 -p 3001` and open that port instead.
- **"Could not find a production build":** run `npm run build` first.
- **A Forbidden page:** open <http://127.0.0.1:3000> or <http://localhost:3000>.
- **"The task list could not be loaded":** the terminal where the app runs shows why.
- Start the app with `npm start` or `npm run dev`. They pass `-H 127.0.0.1`, which keeps the app reachable from this computer only. If you run `next` yourself, always pass `-H 127.0.0.1`.

## How to use it

- **Add a task** with the Add a task button in the header. Name, due date, and difficulty are required. Group and description may be empty. A group is free text: groups you already used are suggested, and a new group gets one of 8 colors from a grid.
- **The card in the middle is the current task.** The page opens on Up next with the Do now task current: the first task that is due soon or, if none is, the first one due later this week. Move through the stack with the left and right arrow keys, Home and End (with the focus in the stack), the scroll wheel or trackpad (sideways, or up and down when the page itself does not scroll), Previous and Next, or by clicking a card in the stack.
- **The queue.** The week runs Monday through Sunday. Due soon is overdue, due today, or due tomorrow. Rest of this week is everything after that through Sunday. Later is after Sunday and is never Do now.
- **Mark done** on the name card asks first. A done task moves to Completed, which lists this week's tasks, newest first. **Mark open** there brings a task back.
- **Edit** on the info card opens the same dialog as Add a task, with every field filled in. To postpone a task, change its due date. **Delete** asks first.
- **Filters.** The five views along the top, the group and difficulty menus, and the search box combine. **Clear filters** resets the menus and the search and keeps the view. The address holds the filters, so Back and a bookmark work.
- **Group colors.** There are 8, no two groups share one, and a group keeps its color. When all 8 are taken, a new group cannot be added: leave the group empty, choose an existing group, or delete an old group's tasks to free its color. On Completed, **Clear old completed** deletes tasks completed before this week, after asking first. A group left with no tasks goes too, which frees its color.

## Working on the code

`npm run dev` starts the dev server on the same address, reloads as you edit, and uses the same `data/`. The only requests it makes outside this computer are Next.js's own: a version check, and a check of npm's security advisories for the installed Next.js, which `npm run build` makes too. `npm start` makes neither.

`npm run verify` runs the public-repo check, typecheck, lint, format check, and tests. CI runs it, then a build, on every push to `main` or `develop` and on every pull request.

The repository is public, so the public-repo check fails on anything private in a tracked or new file. It prints only the file, the line, and the rule, and it needs git. `CLAUDE.md` lists what it looks for. Put your own name, emails, and other personal terms in `.public-check.local`, one per line. That file is not tracked.

`CLAUDE.md` has the rules for working on the code, and `LOG.md` records each piece of work.

## Scripts

| Script                 | What it does                                            |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Start the dev server on 127.0.0.1                       |
| `npm run build`        | Build for production                                    |
| `npm start`            | Run the production build on 127.0.0.1                   |
| `npm run typecheck`    | Check types with TypeScript                             |
| `npm run lint`         | Run ESLint                                              |
| `npm run format`       | Format files with Prettier                              |
| `npm run format:check` | Check formatting without changing files                 |
| `npm test`             | Run the tests with Vitest                               |
| `npm run check:public` | Check the files for anything private                    |
| `npm run verify`       | Run the check, typecheck, lint, format check, and tests |
