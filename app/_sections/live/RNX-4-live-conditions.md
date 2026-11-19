# RNX-4: Live conditions section

This record sits beside the code because RNX-4 limits its diff to
`app/_sections/live/**`, `__tests__/live.test.tsx` and `e2e/live*.spec.ts`.

## What changed

The Foundation shell at `#live` is now the real section. The eyebrow and heading are
part of the prerendered page. The stamp and city cards stream in behind one Suspense
boundary, so a slow weather service never holds up the rest of the page.

## How it works

- `Section.tsx` stays synchronous. It renders the heading, a persistent
  `aria-live="polite"` region, and `<Suspense fallback={<LiveSkeleton />}>`.
- `LiveCards.tsx` calls `await connection()`, reads `now()` once, then calls
  `getConditions(instant)`. Every card and the stamp use that one instant.
- `getConditions` contains weather failures itself. If it rejects anyway, `LiveCards`
  logs the error once and shows the notice with a "last checked 0 min ago" stamp.
- `stamp.ts` holds the pure wording rules: `nextOpenText`, `stampText`,
  `lastCheckedText` and `allWeatherFailed`.

| Conditions result | What renders |
|---|---|
| City has weather | Full `LiveCard` |
| City lost its weather, others did not | Card with the unavailable message |
| City has no open slot | Card with `noOpenSlot`, no badge or stats |
| Every city lost its weather | One `Notice`, no cards |
| `getConditions` rejected | One `Notice`, no cards |

## Decisions worth knowing

- **Stamp position:** the comps win over the ticket's "under the cards" wording. The
  stamp sits in the heading row above 1024px, and between heading and cards below it.
- **Stylesheet:** the Turbopack rule in `next.config.ts` treats every `*.css` file as
  plain CSS, so `live.module.css` exports no class map. It is imported for its side
  effect, and every selector starts with `rally-live`.
- **Card height:** one class, `rally-live__card-box`, sets the height of live and
  skeleton cards, so they cannot drift apart. A card that lost its weather shrinks to
  its content only when the cards are stacked, as comp 06 shows.
- **Status dot:** the comp's brighter green is not a design token, so the dot uses
  `--color-court-surface`.
- **Notice icon:** it is 28px at every width, as the ticket requires. Phone comp 07
  shows it smaller.

## Configuration and data

There are no new settings, dependencies, routes or database changes. `WEATHER_URL` and
`RALLY_NOW` keep their existing meaning.

## Validate it

```sh
npm run lint
npm test
npm run test:e2e
```
