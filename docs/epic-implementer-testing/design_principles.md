# Design Principles — Rally

Rally helps people find public outdoor pickleball courts that are open and playable right now. The product is honest, outdoorsy and fast: it answers "can I play, and where?" at a glance. The design serves that answer. It is not decoration.

## Source of truth

- The approved comps and the style guide define the look. When a ticket attaches comps, match them at both reference widths (1280px desktop, 390px phone): layout, spacing, type, color and radii. Do not "improve" a comp; raise the difference instead.
- All design values live as Tailwind 4 `@theme` tokens in `app/globals.css`: colors, radii and font families. Components use tokens, never raw hex values or one-off sizes. A value the tokens do not cover is either added to the theme on purpose or not used.
- All user-visible copy, including `aria-label` and `alt` text, comes from the content file through `lib/content.ts`. Components contain no English strings, only class names, ids, hrefs and URLs. Dynamic values fill `{name}` placeholders in the content; they are not concatenated into new sentences.

## Visual language

- **Palette:** deep court green with a bright tennis-ball yellow-green accent, on a light, slightly warm ground. Bands alternate between ground, white paper and court green to separate sections. Light theme only; there is no dark mode.
- **Color carries meaning sparingly.** Ball color is reserved for primary actions and the single headline accent. Status uses three fixed badge pairs: green for good (playable, open, success), amber for caution (breezy, already done) and grey for unavailable (not today, closed). Red is for form errors only. Never introduce a new status color, and never rely on color alone: every status also has a word.
- **Type:** Bricolage Grotesque (heavy) for headings and the wordmark, Inter for everything else. Headings are fluid between their minimum and maximum sizes. Eyebrows are small, uppercase, letter-spaced and bold, and sit above every section heading.
- **Shape:** soft and rounded. Pills (999px) for buttons and badges, about 14px for cards, 10px for inputs and chips, and larger radii for hero-scale art. Cards are white on a 1px line-colored border with little or no shadow; shadow is reserved for hero-scale art.
- **Illustration is drawn in code.** Product art (such as the court drawing) is built from CSS and markup to a written spec, not from bitmap images. Icons and the logo are small SVG files. No stock photography.

## Layout and spacing

- One centred content column (1160px max, 24px gutter, 16px at 520px and below). Sections have generous vertical padding (72px, 56px at 768px and below).
- Use the spacing steps 8, 12, 16, 20–28, 48 and 72. Avoid arbitrary values in between.
- Breakpoints are 1024px, 768px and 520px, and each applies **at or below** its width. Tailwind's `max-*` variants exclude the boundary width, so define custom queries that include it.
- Responsive behavior is stacking, not hiding content. Multi-column grids collapse to one column at 1024px or 768px. The only thing removed on small screens is secondary navigation, and only when the primary call to action stays visible.
- No sideways scrolling at any width from 320px up. Long words, chips and tables must wrap or shrink.

## Components

- Shared primitives live in `app/_components/` (for example `Button`, `Badge`, `SectionHeading`). Each feature section lives in its own folder under `app/_sections/<feature>/` and owns everything specific to it.
- Reuse a primitive before creating a variant, and add a variant to the primitive before building a near-copy. Variants are a closed, named set (for example `ball | ghost | court` buttons), not free-form style props.
- Primitives contain no copy. Callers pass text from the content file.
- Every section follows the same anatomy: an eyebrow and a heading (`SectionHeading`), then the body, with a stable anchor id that navigation can link to.
- Choices are real form controls: segmented controls are radio groups, toggles are checkboxes, and accordions are native `<details>`/`<summary>`.

## Server-first, resilient rendering

- Render on the server by default. Add `'use client'` only to the smallest component that needs browser state or events, and pass it only the props it needs, not whole content objects.
- The page shell renders immediately and never waits on slow data. Anything that depends on the clock, the network or the database is deferred inside a Suspense boundary or served from a route handler, as Next.js 16 `cacheComponents` requires.
- A loading placeholder has the same box and height as the content it replaces, so nothing below it moves when data arrives (target CLS below 0.1).
- Partial failure stays partial. When one item's data fails, that item shows its own plain-language unavailable message while everything else renders normally. Only when everything fails does a single section-level notice replace the content. A failure never breaks the page.
- Server and first client render must match. Browser-only values (time zone, locale) are applied after hydration in a way that cannot cause a mismatch, with no `suppressHydrationWarning`.

## Works without JavaScript

- Filters and forms are real `<form>` elements. Filter state lives in the URL query, so a reload, a shared link and a no-JS submit all produce the same server-rendered result. Forms post and validate on the server.
- JavaScript enhances: instant filter updates, pending states and inline results. It never gates a core task.

## Time and data honesty

- Show times in the place they apply (the court's or city's local time), never the visitor's or the server's time zone, and say so ("local time", "Times are local to each court").
- Formatting follows the content file's format rules (for example "6:00 pm", "2 Nov") and is done by the shared formatters, not inline.
- State freshness ("updated 5 min ago") wherever data can be stale, and never present stale or missing data as current.

## Accessibility (baseline, not polish)

- Every interactive element is reachable and operable by keyboard, in visual order. Hidden elements are not tabbable.
- One visible focus style everywhere: a 3px solid focus-blue outline with a 2px offset. Never remove it without replacing it with the same ring.
- Controls are at least 44px tall; buttons are 48px.
- Every field has a visible label. Errors appear under their field, are associated with it, and keep the visitor's input.
- Regions that load or change after an action (live data, results, form outcomes) are announced with `aria-live`. Decorative images have empty `alt`; meaningful drawings get `role="img"` and a label from the content file.
- Contrast meets WCAG AA. Text on court green uses the designated on-court colors.

## Motion

- Motion is functional and minimal: a loading shimmer and a button spinner. No decorative animation, parallax or scroll effects.
- Every animation stops under `prefers-reduced-motion: reduce`.

## Privacy and trust in the UI

- No accounts, tracking, third-party scripts or external assets at runtime. Fonts are self-hosted at build time through `next/font`.
- Never display or echo personal data (such as an email address) except back to the person who submitted it.
- Copy is plain and friendly, and it never overpromises. A pending action says what it is doing ("Joining…") and cannot be triggered twice.
