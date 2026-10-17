# Focusqueue

A queue for one week, for one person on this computer. It shows the one task to do now and the rest of the week in the same order. Tasks can be sorted into groups, each with its own color.

The app listens on `127.0.0.1` only. There is no login, so only this computer can reach it. Task data lives in `data/`, which is not in git.

## Setup

1. Install Node 24. With nvm, run `nvm use` in this folder.
2. Install packages: `npm install`. Dependency install scripts are off on purpose, because `better-sqlite3` ships prebuilt binaries (see `.npmrc`).
3. Turn off Next.js telemetry on this computer, once: `npx next telemetry disable`
4. Start the app: `npm run dev`, then open <http://127.0.0.1:3000>
5. Check your work: `npm run verify` runs typecheck, lint, format check, and tests.

## Scripts

| Script                 | What it does                                 |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Start the dev server on 127.0.0.1            |
| `npm run build`        | Build for production                         |
| `npm start`            | Run the production build on 127.0.0.1        |
| `npm run typecheck`    | Check types with TypeScript                  |
| `npm run lint`         | Run ESLint                                   |
| `npm run format`       | Format files with Prettier                   |
| `npm run format:check` | Check formatting without changing files      |
| `npm test`             | Run the tests with Vitest                    |
| `npm run verify`       | Run typecheck, lint, format check, and tests |
