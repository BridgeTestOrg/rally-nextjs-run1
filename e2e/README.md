# Browser tests

The specs run in Chromium against the production build.

## Run them

```sh
npx playwright install chromium   # once
npm run test:e2e                  # builds, then runs every spec
```

After a build, `npm run e2e` runs the specs without building again.

## Servers

Playwright starts these from `playwright.config.ts`. Outside CI it reuses a server
that is already listening on the port.

| Server | Port | Command | Ready when |
|---|---|---|---|
| Weather stub | 4010 | `node e2e/weather-stub.mjs` | `/healthz` responds |
| Default app | 3100 | `node e2e/reset-db.mjs && npx next start -p 3100` | `/favicon.ico` responds |
| Waitlist app | 3101 | `node e2e/reset-db.mjs && npx next start -p 3101` | `/favicon.ico` responds |

Both app servers get `RALLY_NOW=2026-11-17T17:40:00-07:00` and a `WEATHER_URL` that
points at the stub. If the ports are taken, set `E2E_PORT` (default app, with the
waitlist app one port higher) and `E2E_STUB_PORT`.

## Databases

Each app server has its own file, and `e2e/reset-db.mjs` empties it when that server
starts. The script refuses any path outside `test-results/e2e/`.

| Project | Path | Exported constant |
|---|---|---|
| `default` | `test-results/e2e/default/rally.db` | `DEFAULT_E2E_DB_PATH` |
| `waitlist` | `test-results/e2e/waitlist/rally.db` | `WAITLIST_E2E_DB_PATH` |

Import the constants from `playwright.config.ts`. Test artifacts go to
`test-results/artifacts`, so Playwright's cleanup leaves the databases alone.

## Adding specs

Add a file to `e2e/`. The name picks the project, so the config does not change:

| File name | Project |
|---|---|
| `*.spec.ts` | `default` |
| `*.waitlist.spec.ts` | `waitlist`, one worker, no retries |
| `*.weather-*.spec.ts` | Skipped by `default`, for the scenario projects a later ticket adds |

Import `test` and `expect` from `./fixtures`, not `@playwright/test`. The fixture
fails a test on any console error or uncaught page error, and aborts requests to
outside hosts.
