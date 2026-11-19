import { Badge } from "@/app/_components/Badge";
import { content, fill } from "@/lib/content";
import type { CourtRow as CourtRowData } from "@/lib/courts";
import { time } from "@/lib/format";

export function CourtRow({ row }: { row: CourtRowData }) {
  const { finder } = content;
  const meta = [
    fill(finder.meta, {
      city: row.city,
      state: row.state,
      courts: row.courts,
    }),
    row.lights ? finder.metaLights : "",
    row.parking ? finder.metaParking : "",
  ].join("");

  return (
    <div
      className={`rounded-card border border-line px-[18px] pt-3.5 ${
        row.closed ? "bg-ground pb-[18px]" : "bg-paper pb-4"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          <h3 className="font-display text-lg leading-[1.3] font-semibold">
            {row.name}
          </h3>
          <p className="mt-px text-sm text-muted">{meta}</p>
          <p
            className={`mt-1.5 text-sm font-semibold ${
              row.closed ? "text-badge-grey-text" : "text-court-2"
            }`}
          >
            {row.statusText}
          </p>
        </div>
        <div className="pt-0.5">
          {row.closed ? (
            <Badge variant="closed">{finder.closedBadge}</Badge>
          ) : (
            <Badge variant="open">
              {fill(finder.openCount, { count: row.slots.length })}
            </Badge>
          )}
        </div>
      </div>
      {row.closed ? null : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {row.slots.map((slot) => (
            <li
              key={slot.at}
              className="rounded-control border border-line bg-ground px-3 py-1.5 text-sm leading-[22px] font-semibold"
            >
              <time dateTime={slot.at}>
                {time(new Date(slot.at), row.timeZone)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
