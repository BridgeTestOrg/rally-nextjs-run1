import type { WaitlistState } from "@/lib/waitlist";

/**
 * Carries one waitlist result from a no-JavaScript form post to the page that
 * follows it.
 *
 * With `cacheComponents`, Next.js answers a server-action post to a page that has
 * a request-time part with only the resumed stream: the document shell is missing
 * and `useActionState` never receives the returned state. So a form submitted
 * without JavaScript cannot render its own result. The action redirects (303) to
 * the page instead, and the page reads this short-lived cookie on that GET.
 */
export const WAITLIST_FLASH_COOKIE = "rally_waitlist_flash";

/** Long enough for the redirect, short enough that it is gone on the next visit. */
export const WAITLIST_FLASH_MAX_AGE_SECONDS = 30;

type FlashState = Exclude<WaitlistState, { status: "idle" }>;

export function encodeFlash(state: FlashState): string {
  return encodeURIComponent(JSON.stringify(state));
}

/** Returns `null` for a missing, malformed or unrecognised cookie value. */
export function decodeFlash(raw: string | undefined): FlashState | null {
  if (!raw) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw));

    if (typeof value !== "object" || value === null) {
      return null;
    }

    const { status } = value as { status?: unknown };

    if (
      status === "error" ||
      status === "joined" ||
      status === "duplicate"
    ) {
      return value as FlashState;
    }

    return null;
  } catch {
    return null;
  }
}
