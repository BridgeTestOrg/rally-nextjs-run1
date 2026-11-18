# Code Review — Rally

Review against the ticket first, then the project's recorded standards (architecture, design principles, unit and e2e testing instructions). Report real defects with a file and line, a concrete failure scenario, and the smallest fix. Do not restate the diff, praise, or nitpick formatting that lint already enforces.

## Block the merge for

- **Ticket mismatch:** an acceptance criterion not met, or a name the outside contract fixes (URL, query parameter, API path, JSON shape, setting, file path) changed or missing.
- **Correctness:** wrong logic, unhandled error paths, races (such as read-then-write instead of a unique constraint), or time logic that uses the server's or visitor's time zone or reads the clock outside the app's clock module.
- **Next.js 16 rules:** request-time reads (clock, database, outside services, `searchParams`) outside a Suspense boundary or route handler while `cacheComponents` is on; `'use client'` wider than needed; server-only code or secrets reachable from a client module; hydration mismatches.
- **Resilience:** a slow or failing outside service that can block or break the rest of the page, failures that get cached, or a partial failure that is not isolated.
- **Security and privacy:** input not validated on the server, personal data logged or echoed to anyone but its submitter, new outside services, keys or tracking.
- **Accessibility and no-JS:** missing labels, focus ring removed, controls under 44px, unannounced dynamic regions, or a core task that stops working without JavaScript.
- **Tests:** new or changed behavior without the unit or e2e tests the testing instructions require; tests that would pass against an empty implementation; skipped, `.only` or weakened tests.
- **Copy:** user-visible text, `aria-label` or `alt` words hard-coded in components instead of read from the content file.
- **Scope:** edits outside the ticket's files or folders, lint rules disabled or `eslint.config.mjs` changed, or dependencies added without the ticket asking.

## Flag, but do not block

- Raw design values (hex colors, one-off sizes) that should come from theme tokens, where the visual result is still correct.
- Duplication of an existing primitive or helper, unclear names, or dead code left behind.
- Missing coverage of a secondary state the ticket did not call out.

## Stay out of

- Style preferences already settled by the design principles, the comps or lint.
- Redesigning a ticket's approved approach. If the ticket itself looks wrong, say so once as a note, not as a blocking finding.
