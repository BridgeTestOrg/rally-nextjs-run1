"use client";

import {
  useActionState,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Button } from "@/app/_components/Button";
import { content } from "@/lib/content";
import type { WaitlistValues } from "@/lib/waitlist";
import { joinWaitlist } from "./actions";
import { useWaitlistFlash } from "./FlashContext";
import { WaitlistResult } from "./Result";

const INITIAL_VALUES: WaitlistValues = {
  email: "",
  city: "highlands-ranch",
  level: "new",
};

const ERROR_ID = {
  email: "waitlist-email-error",
  city: "waitlist-city-error",
  level: "waitlist-level-error",
};

function errorProps(id: string, message: string | undefined) {
  return message
    ? ({ "aria-invalid": true, "aria-describedby": id } as const)
    : {};
}

/**
 * Stays mounted, even when empty, so a message added after a submission is
 * announced. The control beside it remounts and cannot carry that announcement.
 */
function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <div aria-live="polite">
      {message ? (
        <p id={id} className="rally-waitlist__error">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function WaitlistForm() {
  const { waitlist } = content;
  const flash = useWaitlistFlash();
  const [state, formAction, pending] = useActionState(joinWaitlist, flash);
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const focusedFieldRef = useRef<string | null>(null);

  // Each returned state remounts the controls, so React's automatic reset of
  // uncontrolled forms cannot clear the values shown again below.
  const [tracked, setTracked] = useState({ state, submission: 0 });

  if (tracked.state !== state) {
    setTracked({ state, submission: tracked.submission + 1 });
  }

  const { submission } = tracked;

  useEffect(() => {
    if (!pending) {
      submittingRef.current = false;
    }
  }, [pending]);

  // Pressing Enter in a field must not lose its place when that field remounts.
  useLayoutEffect(() => {
    const name = focusedFieldRef.current;

    focusedFieldRef.current = null;

    if (!name || !formRef.current) {
      return;
    }

    const controls = Array.from(
      formRef.current.querySelectorAll<HTMLInputElement>(`[name="${name}"]`),
    );

    (controls.find((control) => control.checked) ?? controls[0])?.focus();
  }, [submission]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (submittingRef.current) {
      event.preventDefault();
      return;
    }

    submittingRef.current = true;

    const active = document.activeElement;

    focusedFieldRef.current =
      active instanceof HTMLInputElement || active instanceof HTMLSelectElement
        ? active.name
        : null;
  }

  const isResult = state.status === "joined" || state.status === "duplicate";
  const failed = state.status === "error" ? state : undefined;
  const values = failed?.values ?? INITIAL_VALUES;
  const errors = failed?.fieldErrors ?? {};
  const knownCity = Object.hasOwn(waitlist.cities, values.city);

  return (
    <div>
      <div aria-live="polite">
        {isResult ? <WaitlistResult state={state} /> : null}
      </div>

      {isResult ? null : (
        <form
          ref={formRef}
          action={formAction}
          onSubmit={handleSubmit}
          noValidate
          className="rally-waitlist__card"
        >
          <div className="rally-waitlist__field">
            <label htmlFor="waitlist-email" className="rally-waitlist__label">
              {waitlist.fields.email}
            </label>
            <input
              key={submission}
              id="waitlist-email"
              className="rally-waitlist__control"
              type="email"
              name="email"
              autoComplete="email"
              placeholder={waitlist.fields.emailPlaceholder}
              defaultValue={values.email}
              {...errorProps(ERROR_ID.email, errors.email)}
            />
            <FieldError id={ERROR_ID.email} message={errors.email} />
          </div>

          <div className="rally-waitlist__field">
            <label htmlFor="waitlist-city" className="rally-waitlist__label">
              {waitlist.fields.city}
            </label>
            <select
              key={submission}
              id="waitlist-city"
              className="rally-waitlist__control"
              name="city"
              defaultValue={knownCity ? values.city : ""}
              {...errorProps(ERROR_ID.city, errors.city)}
            >
              {knownCity ? null : <option value="" hidden />}
              {/* The label attribute keeps city names out of the page text,
                  where the hero card shows the visitor's city. */}
              {Object.entries(waitlist.cities).map(([value, label]) => (
                <option key={value} value={value} label={label} />
              ))}
            </select>
            <FieldError id={ERROR_ID.city} message={errors.city} />
          </div>

          <fieldset
            className="rally-waitlist__fieldset"
            aria-describedby={errors.level ? ERROR_ID.level : undefined}
          >
            <legend className="rally-waitlist__label">{waitlist.fields.level}</legend>
            <div key={submission} className="rally-waitlist__segments">
              {Object.entries(waitlist.levels).map(([value, label]) => (
                <label key={value} className="rally-waitlist__segment">
                  <input
                    type="radio"
                    name="level"
                    value={value}
                    defaultChecked={values.level === value}
                    {...errorProps(ERROR_ID.level, errors.level)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <FieldError id={ERROR_ID.level} message={errors.level} />
          </fieldset>

          <div aria-live="polite">
            {failed?.serverError ? (
              <p className="rally-waitlist__error rally-waitlist__server-error">
                {failed.serverError}
              </p>
            ) : null}
          </div>

          <Button variant="court" type="submit" loading={pending}>
            {pending ? waitlist.submitting : waitlist.submit}
          </Button>

          <p className="rally-waitlist__fine">{waitlist.fine}</p>

          <p role="status" aria-live="polite" className="rally-waitlist__visually-hidden">
            {pending ? waitlist.submitting : ""}
          </p>
        </form>
      )}
    </div>
  );
}
