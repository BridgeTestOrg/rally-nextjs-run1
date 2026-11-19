# RNX-5: Court finder

## What changed

The `#courts` shell is now the working "Find an open court" section. Visitors filter
by state, day, time, lights and parking. Each court shows its details, local status,
open count and slot times. Closed courts stay listed with their reason, and a dashed
empty state appears when no court is returned.

## Why

The page promised open courts but had no way to look them up. The filters live in the
URL, so a reload, a shared link and a no-JavaScript submit all return the same rows.

## How it works

- `FinderSection` keeps the eyebrow and heading static and puts the request-time work
  inside `<Suspense>`, with `FinderSkeleton` as the fallback.
- `FinderBody` awaits `searchParams`, then `connection()`, then calls `parseFilters` and
  `queryCourts(filters, now())`. Cache Components requires that order. Only parsed
  filters reach the query or index content.
- `FilterForm` is a `next/form` GET form with `action="/"`, `replace` and
  `scroll={false}`. Any change calls `requestSubmit()`. Radios always serialize, and the
  `lights` and `parking` checkboxes serialize as `1` only when checked.
- The inputs are uncontrolled, so the form keeps its DOM nodes and focus across
  navigations. An effect copies committed filters back to the inputs after Back,
  Forward or a link. No client state duplicates the URL.
- Native inputs cover their whole option at zero opacity. This gives a 44px target, and
  the focus ring is drawn on the visible option next to the input.
- `Results` keeps one `aria-live="polite"` region mounted for the count line and local
  time note. The "Clear filters" link sits outside it, so it is not re-announced.
- Without JavaScript, React cannot move streamed content into the Suspense boundary. A
  `<noscript>` stylesheet in `FinderSkeleton` reveals the hidden streamed finder and
  uses flex order to place it after the heading. It depends on React's streaming markup,
  so recheck it when upgrading React or Next.js. The controls still come last in
  keyboard order in this mode, because the element stays at the end of `<body>`.
- `CourtRow` displays what `queryCourts` returns. Status text comes from the row, and
  slot times are formatted in the court's own time zone.

## Key files

- `app/_sections/finder/Section.tsx`
- `app/_sections/finder/FinderBody.tsx`
- `app/_sections/finder/FinderSkeleton.tsx`
- `app/_sections/finder/FilterForm.tsx`
- `app/_sections/finder/Results.tsx`
- `app/_sections/finder/CourtRow.tsx`
- `__tests__/finder.test.tsx`
- `e2e/finder.spec.ts`

## API, configuration and database impact

There are no API, configuration or database changes. The page reads the existing query
parameters: `state`, `day`, `time`, `lights=1` and `parking=1`. Invalid values fall back
to their defaults.

## Usage

- `/` shows today's courts with the default filters.
- `/?state=CO&day=tomorrow` shows Colorado courts for tomorrow.
- `/?day=sat` shows Saturday, including Memorial Park's closure.
- `/?state=NJ&day=today&time=am&lights=1&parking=1` shows the empty state.

To validate, run `npm run lint`, `npm test`, `npm run build` and `npx playwright test`.
