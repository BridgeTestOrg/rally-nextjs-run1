import type { DatabaseSync } from "node:sqlite";
import { content } from "@/lib/content";
import { getDb, immediateTransaction } from "@/lib/db";

export const CITIES = ["highlands-ranch", "santa-monica", "hoboken"] as const;
export const LEVELS = ["new", "mid", "pro"] as const;

export type City = (typeof CITIES)[number];
export type Level = (typeof LEVELS)[number];

export const CITY_TIME_ZONE: Record<City, string> = {
  "highlands-ranch": "America/Denver",
  "santa-monica": "America/Los_Angeles",
  hoboken: "America/New_York",
};

export type WaitlistValues = { email: string; city: string; level: string };

export type FieldErrors = Partial<Record<keyof WaitlistValues, string>>;

export type ValidatedWaitlistValues = {
  email: string;
  city: City;
  level: Level;
};

export type WaitlistState =
  | { status: "idle" }
  | {
      status: "error";
      fieldErrors: FieldErrors;
      values: WaitlistValues;
      serverError?: string;
    }
  | { status: "joined"; email: string; cityLabel: string; place: number }
  | { status: "duplicate"; email: string; cityLabel: string; date: string };

export type ValidationResult =
  | { ok: true; value: ValidatedWaitlistValues }
  | { ok: false; fieldErrors: FieldErrors; values: WaitlistValues };

export type JoinResult =
  | { kind: "joined"; city: City; place: number }
  | { kind: "duplicate"; city: City; createdAt: string };

export const INSERT_SQL = `INSERT INTO waitlist (email, city, level, created_at)
VALUES (?, ?, ?, ?)
ON CONFLICT(email) DO NOTHING
RETURNING created_at`;

export const PLACE_SQL = "SELECT COUNT(*) AS place FROM waitlist WHERE city = ?";

export const EXISTING_SQL = "SELECT city, created_at FROM waitlist WHERE email = ?";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

function isCity(value: unknown): value is City {
  return (CITIES as readonly unknown[]).includes(value);
}

function isLevel(value: unknown): value is Level {
  return (LEVELS as readonly unknown[]).includes(value);
}

/** Reads the three contract fields. Anything that is not a string becomes "". */
export function readValues(
  input: FormData | Record<string, unknown>,
): WaitlistValues {
  const read = (name: keyof WaitlistValues) => {
    const value = input instanceof FormData ? input.get(name) : input[name];

    return typeof value === "string" ? value : "";
  };

  return { email: read("email"), city: read("city"), level: read("level") };
}

export function validate(
  input: FormData | Record<string, unknown>,
): ValidationResult {
  const values = readValues(input);
  const { errors } = content.waitlist;
  const email = values.email.trim();
  const { city, level } = values;
  const fieldErrors: FieldErrors = {};

  if (email.length > MAX_EMAIL_LENGTH || !EMAIL.test(email)) {
    fieldErrors.email = errors.email;
  }

  if (!isCity(city)) {
    fieldErrors.city = errors.city;
  }

  if (!isLevel(level)) {
    fieldErrors.level = errors.level;
  }

  if (isCity(city) && isLevel(level) && Object.keys(fieldErrors).length === 0) {
    return { ok: true, value: { email, city, level } };
  }

  return { ok: false, fieldErrors, values };
}

/**
 * Stores an email once. The insert runs first and the unique constraint decides
 * the winner, so simultaneous requests cannot both join. A duplicate returns the
 * original row and leaves it unchanged.
 *
 * `instant` comes from the caller, so this module never reads the clock. It logs
 * nothing, and the caller keeps ownership of `db`.
 */
export function join(
  value: ValidatedWaitlistValues,
  instant: Date,
  db: DatabaseSync = getDb(),
): JoinResult {
  const email = value.email.trim().toLowerCase();

  return immediateTransaction(db, (): JoinResult => {
    const inserted = db
      .prepare(INSERT_SQL)
      .get(email, value.city, value.level, instant.toISOString());

    if (inserted) {
      const place = db.prepare(PLACE_SQL).get(value.city)?.place;

      if (typeof place !== "number" || place < 1) {
        throw new Error("Waitlist place count returned no usable value.");
      }

      return { kind: "joined", city: value.city, place };
    }

    const existing = db.prepare(EXISTING_SQL).get(email);

    if (!isCity(existing?.city) || typeof existing.created_at !== "string") {
      throw new Error("Waitlist conflict found no usable original row.");
    }

    return {
      kind: "duplicate",
      city: existing.city,
      createdAt: existing.created_at,
    };
  });
}
