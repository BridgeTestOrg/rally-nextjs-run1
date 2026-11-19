"use client";

import Form from "next/form";
import { useEffect, useRef, type FormEvent } from "react";
import { Button } from "@/app/_components/Button";
import { content } from "@/lib/content";
import type { Filters } from "@/lib/filters";

const LEGEND = "rally-eyebrow p-0 leading-5 text-muted";
const FOCUS_RING =
  "peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus";
// Covers the visible option, so the native control is the whole touch target.
const HIDDEN_INPUT =
  "peer absolute inset-0 m-0 size-full cursor-pointer opacity-0";

function SegmentedGroup({
  name,
  legend,
  options,
  selected,
}: {
  name: "state" | "day" | "time";
  legend: string;
  options: Record<string, string>;
  selected: string;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className={`${LEGEND} mb-2`}>{legend}</legend>
      <div className="flex rounded-xl border border-line bg-paper p-[3px]">
        {Object.entries(options).map(([value, label]) => (
          <label key={value} className="relative flex min-w-0 flex-auto">
            <input
              type="radio"
              name={name}
              value={value}
              defaultChecked={selected === value}
              className={HIDDEN_INPUT}
            />
            <span
              className={`flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-lg px-1 text-center text-sm leading-tight font-bold [overflow-wrap:anywhere] peer-checked:bg-court [@media(max-width:520px)]:text-[13px] peer-checked:text-paper ${FOCUS_RING}`}
            >
              {label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CheckboxRow({
  name,
  label,
  checked,
}: {
  name: "lights" | "parking";
  label: string;
  checked: boolean;
}) {
  return (
    <label className="relative flex min-w-0">
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={checked}
        className={HIDDEN_INPUT}
      />
      <span
        className={`flex min-h-11 min-w-0 flex-1 items-center gap-[13px] rounded-control px-1 font-semibold peer-checked:[&>[aria-hidden]]:border-court peer-checked:[&>[aria-hidden]]:bg-court peer-checked:[&_svg]:block ${FOCUS_RING}`}
      >
        <span
          aria-hidden="true"
          className="grid size-5 flex-none place-items-center rounded-[3px] border border-muted bg-paper"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            className="hidden size-3.5 text-paper"
          >
            <path d="M3 8.5 6.5 12 13 4.5" />
          </svg>
        </span>
        <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
      </span>
    </label>
  );
}

function submitOnChange(event: FormEvent<HTMLFormElement>) {
  event.currentTarget.requestSubmit();
}

export function FilterForm({ filters }: { filters: Filters }) {
  const { finder } = content;
  const { state, day, time, lights, parking } = filters;
  const formRef = useRef<HTMLFormElement>(null);

  // The inputs are uncontrolled, so Back, Forward and links need this to keep
  // them in step with the URL. It never moves focus.
  useEffect(() => {
    const committed: Record<string, string> = { state, day, time };

    formRef.current?.querySelectorAll("input").forEach((input) => {
      if (input.type === "radio") {
        input.checked = input.value === committed[input.name];
      } else {
        input.checked = input.name === "lights" ? lights : parking;
      }
    });
  }, [state, day, time, lights, parking]);

  return (
    <Form
      ref={formRef}
      action="/"
      scroll={false}
      replace
      aria-label={finder.formLabel}
      onChange={submitOnChange}
      className="grid min-w-0 gap-5 rounded-card bg-ground p-5 [@media(max-width:520px)]:p-3.5"
    >
      <SegmentedGroup
        name="state"
        legend={finder.groups.state}
        options={finder.states}
        selected={state}
      />
      <SegmentedGroup
        name="day"
        legend={finder.groups.day}
        options={finder.days}
        selected={day}
      />
      <SegmentedGroup
        name="time"
        legend={finder.groups.time}
        options={finder.times}
        selected={time}
      />
      <fieldset className="min-w-0">
        <legend className={`${LEGEND} mb-2.5`}>{finder.groups.mustHave}</legend>
        <CheckboxRow name="lights" label={finder.lights} checked={lights} />
        <CheckboxRow name="parking" label={finder.parking} checked={parking} />
      </fieldset>
      <noscript>
        <Button variant="court" type="submit" className="w-full">
          {finder.submitNoScript}
        </Button>
      </noscript>
    </Form>
  );
}
