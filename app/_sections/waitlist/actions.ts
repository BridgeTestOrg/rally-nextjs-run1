"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { now } from "@/lib/clock";
import { content } from "@/lib/content";
import { date } from "@/lib/format";
import {
  encodeFlash,
  WAITLIST_FLASH_COOKIE,
  WAITLIST_FLASH_MAX_AGE_SECONDS,
} from "@/lib/waitlist-flash";
import {
  CITY_TIME_ZONE,
  join,
  readValues,
  validate,
  type WaitlistState,
} from "@/lib/waitlist";

/**
 * A post from a page without JavaScript carries no `Next-Action` header, which
 * the client always sends. Outside a request, as in unit tests, it is false.
 */
async function isPlainFormPost(): Promise<boolean> {
  try {
    return (await headers()).get("next-action") === null;
  } catch {
    return false;
  }
}

export async function joinWaitlist(
  _previous: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const state = await resolve(formData);

  if (state.status !== "idle" && (await isPlainFormPost())) {
    // See lib/waitlist-flash.ts: this post cannot render its own result.
    (await cookies()).set(WAITLIST_FLASH_COOKIE, encodeFlash(state), {
      path: "/",
      maxAge: WAITLIST_FLASH_MAX_AGE_SECONDS,
      httpOnly: true,
      sameSite: "lax",
    });
    redirect("/#waitlist");
  }

  return state;
}

async function resolve(formData: FormData): Promise<WaitlistState> {
  const { waitlist } = content;
  const validation = validate(formData);

  if (!validation.ok) {
    return {
      status: "error",
      fieldErrors: validation.fieldErrors,
      values: validation.values,
    };
  }

  const { email } = validation.value;

  try {
    const result = join(validation.value, now());

    if (result.kind === "joined") {
      return {
        status: "joined",
        email,
        cityLabel: waitlist.cities[result.city],
        place: result.place,
      };
    }

    // The city and date describe the original sign-up, not this submission.
    return {
      status: "duplicate",
      email,
      cityLabel: waitlist.cities[result.city],
      date: date(new Date(result.createdAt), CITY_TIME_ZONE[result.city]),
    };
  } catch {
    // Database errors can carry bound parameters, so the error stays unlogged.
    console.error("waitlist join failed");

    return {
      status: "error",
      fieldErrors: {},
      values: readValues(formData),
      serverError: waitlist.errors.server,
    };
  }
}
