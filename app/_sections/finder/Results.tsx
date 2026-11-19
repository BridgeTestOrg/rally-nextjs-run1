import Link from "next/link";
import { Button } from "@/app/_components/Button";
import { content, fill } from "@/lib/content";
import type { CourtRow as CourtRowData } from "@/lib/courts";
import type { Filters } from "@/lib/filters";
import { CourtRow } from "./CourtRow";

const CLEAR_HREF = "/#courts";

function countTemplate(count: number): string {
  const { countOne, countMany, countNone } = content.finder;

  if (count === 0) {
    return countNone;
  }

  return count === 1 ? countOne : countMany;
}

export function Results({
  rows,
  count,
  day,
}: {
  rows: CourtRowData[];
  count: number;
  day: Filters["day"];
}) {
  const { finder } = content;

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4">
        {/* Stays mounted so a changed summary is announced. */}
        <div aria-live="polite" aria-atomic="true" className="min-w-0">
          <p className="flex min-h-11 items-center font-bold">
            {fill(countTemplate(count), {
              count,
              day: finder.dayPhrases[day],
            })}
          </p>
          <p className="mt-3 text-[13px] text-muted">{finder.localNote}</p>
        </div>
        <Link
          href={CLEAR_HREF}
          className="inline-flex min-h-11 items-center text-[15px] font-semibold text-court-2 underline underline-offset-2"
        >
          {finder.clear}
        </Link>
      </div>
      {rows.length > 0 ? (
        <ul className="mt-3 grid gap-3">
          {rows.map((row) => (
            <li key={row.id} className="min-w-0">
              <CourtRow row={row} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 rounded-card border border-dashed border-muted/50 px-5 py-10 text-center">
          <p className="font-bold">{finder.emptyTitle}</p>
          <p className="mt-1 text-muted">{finder.emptyBody}</p>
          <Button variant="court" href={CLEAR_HREF} className="mt-4">
            {finder.clear}
          </Button>
        </div>
      )}
    </div>
  );
}
