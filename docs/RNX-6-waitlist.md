# RNX-6: Waitlist

## What changed

The `#waitlist` shell is now the working "Get on the court list" section. Visitors
submit an email, city and skill level, and the server stores each email once in
SQLite. The form shows error, "Joining…", duplicate and success states, and it also
works as a plain form post with JavaScript off.

## Why

The hero's "Join the waitlist" button had no form to land on. The waitlist is the
page's way of collecting city-segmented interest before launch.

## How it works

- `migrations/001_waitlist.sql` creates the table. `lib/db.ts` applies numbered
  migrations inside `BEGIN IMMEDIATE`, so concurrent processes run them once.
  `PRAGMA user_version` records the applied version. Opening fails if the schema
  cannot reach version 1.
- `getDb()` opens `DATABASE_PATH` (default `data/rally.db`) on first use, never at
  import time. A handle from `openDb()` belongs to its caller.
- `join()` in `lib/waitlist.ts` inserts first with `ON CONFLICT(email) DO NOTHING`,
  then counts the city or reads the original row in the same transaction. A duplicate
  never changes the stored row.
- `joinWaitlist` in `app/_sections/waitlist/actions.ts` validates on the server and
  takes the time from `lib/clock.ts`. A duplicate's city and date come from the stored
  row. Unexpected failures return the generic server error and log one fixed message
  with no submitted data.
- `WaitlistForm` uses `useActionState` on a native `<form>`, so the same action serves
  enhanced and no-JavaScript submissions. Controls remount after each returned state,
  which stops React's form reset from clearing the kept values. Error messages sit
  outside the remounted controls in live regions that stay mounted.
- `WaitlistSection` stays a static Server Component with no database or clock read.

## Key files

| Path | Purpose |
|---|---|
| `migrations/001_waitlist.sql` | Table, allow-lists and city index |
| `lib/db.ts` | Connection, migration runner and transaction helper |
| `lib/waitlist.ts` | Allow-lists, state types, validation, SQL and `join()` |
| `app/_sections/waitlist/actions.ts` | Server action |
| `app/_sections/waitlist/WaitlistForm.tsx`, `Result.tsx`, `Section.tsx` | Interface |
| `app/_sections/waitlist/waitlist.css` | Section styles |
| `next.config.ts` | Includes the migration SQL in the server trace |

## Configuration and data

- `DATABASE_PATH` sets the SQLite file. `RALLY_NOW` also sets `created_at`.
- The section uses a plain stylesheet with `rally-waitlist__*` classes. The Turbopack
  rule in `next.config.ts` handles every `*.css` file as plain CSS, so a CSS Module
  would not produce scoped class names.
- No email is sent, and no outside service is called.

## Validation

```sh
npm run lint
npm test
npm run build
npx playwright test --project=waitlist
```
