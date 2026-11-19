# RNX-3: Courts and weather data layer

## What changed

Rally now has its server-side data layer: the six-court data file, local-time schedule
logic, the finder's filter parser and court query, the verdict rules, a National Weather
Service (NWS) client with a success-only cache, and the conditions service. Two JSON
routes expose it, `GET /api/courts` and `GET /api/conditions`. There is no UI in this
change. The Live and Finder tickets render on top of these contracts.

## Why

Every later section needs the same answers: which courts are open, which slots remain,
and whether the next slot is playable. Each answer depends on the court's own time zone
and on a clock that tests can replace, so the logic lives in one place.

## How it works

- `lib/zoned.ts` converts between instants and local dates with `Intl`. A repeated local
  time resolves to its earlier occurrence, and a skipped one moves to the first time
  after the gap.
- `lib/schedule.ts` holds the pure schedule rules. Every function takes the instant as
  an argument. Only the route handlers and the forecast's `fetchedAt` stamp call `now()`.
- `lib/courts.ts` is the only importer of `data/courts.json`. It checks the file's shape
  when it loads and throws, naming the bad path, if anything is wrong.
- `queryCourts` follows the finder's rules: closed courts stay, and open courts with no
  matching slot are dropped. `courtsApi` lists every court matching state, lights and
  parking, and `day` has no effect on it.
- `lib/weather.ts` makes the two NWS requests with redirects off. The hourly URL must be
  on the same origin as `WEATHER_URL`.
- `lib/conditions.ts` fetches the three cities at once, with one 3 second deadline per
  city that covers the cache lookup and any fallback fetch. It never rejects.

## Forecast cache

The cache is Approach A from the ticket: `getCachedForecast` uses `"use cache"` with
`cacheLife({ stale: 60, revalidate: 300, expire: 600 })`. A production probe against the
`weather-fail-one` stub chose it:

| Check | Result |
|---|---|
| A failed fetch is not cached | Hoboken `/points` went 1 then 2 over two requests |
| A success is reused | CO and CA stayed at 1 on the second request |
| The build reads no weather | All stub counts stayed 0, both routes are listed as dynamic |
| Processes do not share a cache | A second `next start` raised CO and CA from 1 to 2 |

Each process therefore has its own cache. `isFresh` rejects a stamp older than ten
minutes, and a stale hit falls through to an uncached fetch inside the same deadline.

Expected weather failures carry a fixed `digest`, because that is the one error field
that survives the `"use cache"` boundary in production. Rally logs nothing for them.
Next.js logs errors thrown inside a cached function, so a production server still prints
each one. Anything without the digest is reported once per city with `console.error`.

## Configuration

| Setting | Effect |
|---|---|
| `WEATHER_URL` | Weather service origin, default `https://api.weather.gov`. Must be http or https with no credentials. |
| `RALLY_NOW` | Replaces the clock, and is part of the forecast cache key. |

`server-only` is a new dependency. The API sends `Cache-Control: no-store`, and forecast
reuse happens only inside `lib/weather.ts`.

## Tests

The weather stub (`e2e/weather-stub.mjs`) takes `STUB_PORT` and `STUB_SCENARIO`, and
serves read-only hit counts at `/__hits`. `playwright.config.ts` has one project, app
server and stub per scenario. See `e2e/README.md`.

```sh
npm test
npm run test:e2e
curl 'http://127.0.0.1:3100/api/courts?state=CA'
```
