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
| Weather stub (`ok`) | 4010 | `node e2e/weather-stub.mjs` | `/healthz` responds |
| Default app | 3100 | `node e2e/reset-db.mjs && npx next start -p 3100` | `/favicon.ico` responds |
| Waitlist app | 3101 | `node e2e/reset-db.mjs && npx next start -p 3101` | `/favicon.ico` responds |

Each weather scenario also gets its own stub and app server:

| Project | App port | Stub port |
|---|---|---|
| `weather-slow` | 3102 | 4011 |
| `weather-timeout` | 3103 | 4012 |
| `weather-fail-one` | 3104 | 4013 |
| `weather-fail-all` | 3105 | 4014 |

Every app server gets `RALLY_NOW=2026-11-17T17:40:00-07:00` and a `WEATHER_URL` that
points at its stub. If the ports are taken, set `E2E_PORT` (default app, with the other
apps on the following ports) and `E2E_STUB_PORT` (the `ok` stub, with the scenario stubs
on the following ports).

## Weather stub

`STUB_PORT` and `STUB_SCENARIO` choose the port and scenario, one scenario per process.

| Scenario | Behavior |
|---|---|
| `ok` | The comp 04 values for each city |
| `weather-slow` | `ok` values, with each hourly response delayed 2 s |
| `weather-timeout` | Every `/points` and hourly response delayed 4 s |
| `weather-fail-one` | Hoboken `/points` returns 500 |
| `weather-fail-all` | Every `/points` returns 500 |

`GET /__hits` returns the `/points` and hourly counts and the last `User-Agent` for each
of `CO`, `CA` and `NJ`. Specs read it through `testInfo.project.metadata.stubURL`.

## Databases

Each app server has its own file, and `e2e/reset-db.mjs` empties it when that server
starts. The script refuses any path outside `test-results/e2e/`.

| Project | Path | Exported constant |
|---|---|---|
| `default` | `test-results/e2e/default/rally.db` | `DEFAULT_E2E_DB_PATH` |
| `waitlist` | `test-results/e2e/waitlist/rally.db` | `WAITLIST_E2E_DB_PATH` |
| `weather-*` | `test-results/e2e/<project>/rally.db` | None |

Import the constants from `playwright.config.ts`. Test artifacts go to
`test-results/artifacts`, so Playwright's cleanup leaves the databases alone.

## Adding specs

Add a file to `e2e/`. The name picks the project, so the config does not change:

| File name | Project |
|---|---|
| `*.spec.ts` | `default` |
| `*.waitlist.spec.ts` | `waitlist`, one worker, no retries |
| `*.weather-slow.spec.ts` and the other scenario suffixes | That scenario's project, one worker, no retries |

Import `test` and `expect` from `./fixtures`, not `@playwright/test`. The fixture
fails a test on any console error or uncaught page error, and aborts requests to
outside hosts.
