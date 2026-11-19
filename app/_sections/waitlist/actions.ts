"use server";

import { now } from "@/lib/clock";
import { content } from "@/lib/content";
import { date } from "@/lib/format";
import {
  CITY_TIME_ZONE,
  join,
  readValues,
  validate,
  type WaitlistState,
} from "@/lib/waitlist";

export async function joinWaitlist(
  _previous: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
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
