const EXPLICIT_OFFSET = /(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * The current time, and the only place in the app that reads the clock.
 *
 * When `RALLY_NOW` is set it replaces the real clock. It must be an ISO time
 * with an explicit `Z` or `±HH:MM` offset; anything else throws, so a
 * misconfigured fixed clock fails loudly instead of falling back to real time.
 * The variable is read on every call and is never `NEXT_PUBLIC_`.
 *
 * Server-only by contract: no `'use client'` module may import this file.
 * `next.config.ts` enables `cacheComponents`, so a Server Component may call
 * `now()` only after `await connection()` inside a Suspense subtree. See
 * `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md`.
 */
export function now(): Date {
  const fixed = process.env.RALLY_NOW;

  if (fixed === undefined) {
    return new Date();
  }

  if (!EXPLICIT_OFFSET.test(fixed)) {
    throw new Error(
      `RALLY_NOW must be an ISO time ending in Z or ±HH:MM, got "${fixed}".`,
    );
  }

  const instant = new Date(fixed);

  if (Number.isNaN(instant.getTime())) {
    throw new Error(`RALLY_NOW is not a valid date: "${fixed}".`);
  }

  return instant;
}
