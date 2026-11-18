# End-to-End Testing — Rally (Playwright)

## Setup that exists

- Framework: `@playwright/test`, configured in `playwright.config.ts`. Specs live in `e2e/` and are named `*.spec.ts`. Vitest excludes `e2e/**`; never put Playwright specs under `__tests__/`, and never import Vitest or Testing Library into an e2e spec.
- Run with `npm run test:e2e`. The config's `webServer` builds and starts the production app (`next build` + `next start`) on port 3000 and sets `baseURL`, so specs navigate with relative paths (`page.goto('/')`), never a hardcoded host.
- Only the `chromium` project is configured. Do not add browsers or projects unless the ticket asks for it.

## When an e2e test is required

- Every ticket that adds or changes user-visible UI — a page, a route, or a component rendered on a page — adds or updates at least one Playwright spec that exercises that UI through the page a real user visits.
- Test UI components in the context of the route that renders them. Do not add test-only routes, pages, or query flags to production code to reach a component; if a component is not yet reachable from any route, cover it with a Vitest + React Testing Library unit test and say so in the PR.
- Pure logic, formatting, and data-shaping changes with no user-visible effect do not need an e2e test; they need unit tests.

## What to assert

- Assert what the user observes: rendered headings and content, navigation and the resulting URL, form validation messages, and loading, empty, and error states the UI is meant to show.
- Cover the critical path of the feature, plus its main failure state (validation error, empty result, unavailable data). A few high-value journeys beat many shallow ones.
- Distinguish precondition, action, and outcome in each test, with one behavior per test and a name that reads as a sentence.

## Locators and waiting

- Prefer `page.getByRole(...)` with an accessible name, then `getByLabel`, `getByPlaceholder`, `getByText` where the wording is the contract. Use `data-testid` (via `getByTestId`) only when no accessible locator is stable. Never locate by CSS class — Tailwind utility classes are styling, not contract.
- A component that cannot be found by role or label is usually an accessibility defect; fix the markup rather than reaching for a brittle selector.
- Use web-first assertions (`await expect(locator).toBeVisible()`, `toHaveURL`, `toHaveText`) and Playwright's auto-waiting. Never use `page.waitForTimeout` or fixed sleeps, and do not wait for `networkidle`.

## Independence and data

- Each spec must pass alone, in any order, and in parallel (`fullyParallel` is on). Create the data a test needs inside the test with unique identifiers and leave no residue for other tests.
- Never point the suite at production or at shared data. Keep credentials and secrets out of specs, fixtures, traces, and screenshots; read any required test configuration from environment variables.
- Mock or intercept third-party network calls with `page.route` only at the external boundary; never mock the app's own pages or components.

## Suite hygiene

- Reuse existing helpers in `e2e/` before writing new ones. Introduce a shared fixture or page-object helper only once two or more specs need the same steps.
- Never skip, `.only`, comment out, delete, or weaken a failing test to get a green run — fix the cause or report it. `forbidOnly` is on whenever `CI` is set and retries are 0: a flaky test is a defect, not something to retry away.
- Traces and screenshots are kept on failure; use them to diagnose. Do not commit `test-results/` or `playwright-report/`.
- Before finishing, run `npm run test:e2e` and confirm the new spec actually executed and passed, alongside `npm test` and `npm run lint`.
