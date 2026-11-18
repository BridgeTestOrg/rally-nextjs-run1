# Unit Testing — Rally (Vitest + React Testing Library)

## Setup that exists

- Runner: Vitest (`vitest.config.mts`, `jsdom` environment, `vite-tsconfig-paths` so `@/` imports resolve). Run with `npm test` (`vitest run`, single pass, no watch).
- Libraries installed: `vitest`, `@testing-library/react`, `@testing-library/dom`. Not installed: `@testing-library/jest-dom` and `@testing-library/user-event`. Do not use their APIs (`toBeInTheDocument`, `userEvent`) unless the ticket adds the package; use Vitest matchers and `fireEvent` from `@testing-library/react`.
- Vitest globals are off: import `test`, `expect`, `vi`, `describe`, `beforeEach` etc. from `vitest` in every file.
- `vitest.setup.ts` runs Testing Library `cleanup()` after each test. Do not remove it; do not add a second cleanup mechanism.
- Tests live in `__tests__/`, mirroring the source path (`app/page.tsx` → `__tests__/page.test.tsx`; `app/foo/bar.tsx` → `__tests__/foo/bar.test.tsx`), named `*.test.ts` / `*.test.tsx`. `e2e/` is excluded from Vitest and belongs to Playwright.

## When a unit test is required

- Every ticket that adds or changes a component, hook, utility, or server-side function adds or updates unit tests for it in the same change.
- A bug fix adds a regression test that fails against the old behavior.
- Do not unit test `async` Server Components: Vitest cannot render them (per the Next.js 16 testing guide). Cover their rendered result with a Playwright e2e spec, and unit test the plain functions they call.
- Synchronous Server Components and Client Components can be rendered with `render()`.

## Testing components

- Query the way a user perceives the UI: `screen.getByRole` with an accessible name first, then `getByLabelText`, `getByText`. Use `getByTestId` only when nothing accessible is stable. Never query by CSS class — Tailwind classes are styling, not behavior.
- Use `getBy*` when the element must exist, `queryBy*` to assert absence, `findBy*` (awaited) for content that appears asynchronously.
- Assert behavior and output: visible text, roles, `disabled`/`aria-*` state, and callback props called with the right arguments. Do not assert on component internals, state variables, or snapshot markup.
- Cover each designed state the component has: default, loading, empty, error, and disabled where they exist.
- Wrap interactions with `fireEvent`; for async effects, `await` a `findBy*` or `waitFor` instead of sleeping.

## Mocking

- Mock only external boundaries: `fetch`/network, time (`vi.useFakeTimers`), randomness, and Next.js runtime modules that need a server or router (`next/navigation`, `next/headers`) via `vi.mock`. Never mock the component or function under test.
- Restore mocks after each test (`vi.restoreAllMocks()` / `vi.useRealTimers()` in `afterEach`) so tests stay independent and order-free.
- `next/image` and `next/link` render in jsdom; do not mock them unless a test needs to.

## Assertions and structure

- One behavior per test, arrange–act–assert, and a name that states the behavior.
- Compute expected values independently (literals), never by calling the production code again.
- Cover edges: empty and missing props/data, boundary values, and error paths.
- A test that would still pass against an empty implementation is not a test — strengthen it.

## Before finishing

- Run `npm test` and confirm the new tests were collected and pass, then `npm run lint`. Never skip, `.only`, or weaken a failing test to get a green run.
