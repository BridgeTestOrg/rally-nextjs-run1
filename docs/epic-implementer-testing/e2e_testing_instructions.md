# End-to-End Testing — Rally (Playwright)

## Setup that exists

- Framework: `@playwright/test` with Chromium only. Specs live in `e2e/` and are named `*.spec.ts`. Vitest excludes `e2e/**`; never put Playwright specs under `__tests__/`, and never import Vitest or Testing Library into an e2e spec.
- `playwright.config.ts` and `e2e/README.md` (when present) are the source of truth for the harness: servers, ports, projects, environment settings and database paths. Read them before writing a spec. Do not hardcode hosts or ports in specs: navigate with relative paths (`page.goto('/')`) so each project's `baseURL` applies.
- Specs run against the production build (`next build`, then `next start`), never `next dev`. Run the suite with `npm run test:e2e`.
- When a ticket specifies the harness itself (servers, projects, fixtures, scripts), implement exactly what the ticket specifies, even where it differs from what is in the repository today, and keep `e2e/README.md` in step with it.
- When `e2e/fixtures.ts` exists, every spec imports `test` and `expect` from it, not from `@playwright/test`, so shared checks such as the console-error listener apply to every test.

## When an e2e test is required

- Every ticket that adds or changes user-visible UI (a page, a route, or a section or component rendered on a page) adds or updates at least one Playwright spec that exercises it through the page a real user visits.
- Test components in the context of the route that renders them. Do not add test-only routes, pages or query flags to production code to reach a component.
- Pure logic, formatting and data-shaping changes with no user-visible effect need unit tests, not e2e tests.
- Prefer adding a new spec file over editing the config. When the config defines scenario projects selected by file suffix, opt in by naming the spec with that suffix.

## What to assert

- Assert what the user observes: rendered headings and content, navigation and the resulting URL, form validation messages, and the loading, empty and error states the UI is meant to show.
- Cover the critical path of the feature plus its main failure state (validation error, empty result, unavailable data). A few high-value journeys beat many shallow ones.
- Cover the behaviors the product promises outside the happy path when the ticket touches them: the page with JavaScript disabled (`javaScriptEnabled: false`), browser time zones (`timezoneId`), both reference viewports (1280px and 390px), keyboard access, and an empty browser console.
- Distinguish precondition, action and outcome in each test, with one behavior per test and a name that reads as a sentence.

## Locators and waiting

- Prefer `page.getByRole(...)` with an accessible name, then `getByLabel`, `getByPlaceholder`, and `getByText` where the wording is the contract. Use `getByTestId` only when no accessible locator is stable. Never locate by CSS class: Tailwind utility classes are styling, not a contract. Generic sweeps (overflow, focus ring, tab order) may query by element type.
- A component that cannot be found by role or label is usually an accessibility defect. Fix the markup rather than reaching for a brittle selector.
- Use web-first assertions (`await expect(locator).toBeVisible()`, `toHaveURL`, `toHaveText`) and Playwright's auto-waiting. Never use `page.waitForTimeout` or fixed sleeps, and do not wait for `networkidle`.

## Time, external services and data

- Never depend on the real clock. Set the app's fixed-clock setting (`RALLY_NOW`) through the server environment the config defines, so dates, "open now" and freshness text are deterministic.
- The app's server-side calls to outside services (such as the weather service) go to a local stub server selected through environment settings (such as `WEATHER_URL`). Never let a test reach a real outside service. `page.route` cannot intercept server-side requests; use it only for requests the browser itself makes. To cover a new outside behavior, extend the stub with a named scenario rather than mocking inside the app.
- Each app server uses its own database file under `test-results/`, reset before the server starts. Never point a test at `data/` or at shared data. Tests that write data run in the project the config dedicates to that state (single worker), and each test either uses unique values or resets the state it needs.
- Keep credentials and secrets out of specs, fixtures, traces and screenshots.

## Independence and hygiene

- Each spec must pass alone and in any order. Specs in parallel projects must also pass in parallel.
- Reuse existing helpers and fixtures in `e2e/` before writing new ones. Add a shared helper only once two or more specs need the same steps.
- Never skip, `.only`, comment out, delete or weaken a failing test to get a green run: fix the cause or report it. Retries are off by design, so a flaky test is a defect, not something to retry away.
- Traces and screenshots are kept on failure; use them to diagnose. Never commit `test-results/`, `playwright-report/` or `blob-report/`.
- Before finishing, run `npm run test:e2e` and confirm the new spec actually executed and passed, alongside `npm test` and `npm run lint`.
