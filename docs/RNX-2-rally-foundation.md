# RNX-2: Rally foundation

## What changed

The create-next-app placeholder at `/` is now the Rally page frame: header, hero,
How it works, FAQ and footer, plus heading-only shells for the Live, Finder and
Waitlist sections. The ticket also adds the shared content, formatting and clock
modules, the `Badge` and `Button` primitives, and the Rally theme.

## Why

This is the first feature in the Rally epic. Later tickets each fill in one section
folder and reuse these building blocks, so navigation and calls to action must land
on real anchors from the start.

## How it works

- `app/page.tsx` is a synchronous Server Component. It passes the unresolved
  `searchParams` promise to `FinderSection` and awaits nothing, so the page stays
  prerenderable under `cacheComponents`.
- All visible copy comes from `content/rally.json` through `lib/content.ts`. Use
  `fill(template, values)` for `{name}` placeholders.
- `lib/format.ts` formats a `Date` in an explicit IANA zone and never reads the host
  zone.
- `lib/clock.ts` is the only clock. `RALLY_NOW` replaces it and must carry a `Z` or
  `±HH:MM` offset, otherwise `now()` throws. Server Components must call it only after
  `await connection()` inside a Suspense subtree. Client modules must not import it.
- `HeroCard` is the only browser-dependent component. It reads the time zone through
  `useSyncExternalStore` with a `null` server snapshot, so the server and hydration
  render the default card and the local city appears afterwards with no mismatch.
- The court is drawn in CSS. Its card is a sibling of the `role="img"` element so the
  card text stays available to assistive technology.

## Key files

| Path | Purpose |
|---|---|
| `content/rally.json`, `public/logo.svg` | Unmodified copies of the brief's assets |
| `lib/content.ts`, `lib/format.ts`, `lib/clock.ts` | Shared content, formatting and time |
| `app/globals.css` | Theme tokens, layout rules and component styles |
| `app/layout.tsx` | Fonts and metadata |
| `app/_components/` | Header, hero, court drawing, static sections, `Badge`, `Button` |
| `app/_sections/{live,finder,waitlist}/Section.tsx` | Shells that later tickets replace |

## Configuration

- `RALLY_NOW` is optional and read on the server only.
- Bricolage Grotesque loads as a variable font with the `opsz` axis. That range covers
  the 600 and 800 weights, and the axis produces the tighter large headings in the
  comps.
- Breakpoints apply at or below 1024px, 768px and 520px. They are plain media queries
  because Tailwind's `max-*` variants exclude the boundary width.
- `/data/rally.db*` is git-ignored for the Waitlist ticket. This ticket creates no
  database.

## Validation

```sh
npm run lint
npm test
npm run build
```

With `RALLY_NOW=2026-11-17T17:40:00-07:00`, a browser in `America/Denver` shows the
"Near you" card for Highlands Ranch. A browser in `Europe/London`, or one with
JavaScript off, shows the default "3 cities" card.
