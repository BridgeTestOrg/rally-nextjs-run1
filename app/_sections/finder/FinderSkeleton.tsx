/** The filter and results columns, shared so loading does not shift the page. */
export const FINDER_LAYOUT =
  "mt-7 grid grid-cols-[360px_minmax(0,1fr)] items-start gap-7 [@media(max-width:1024px)]:grid-cols-[minmax(0,1fr)]";

const PANEL_GROUPS = ["state", "day", "time"];
const CHECK_ROWS = ["lights", "parking"];
const CARD_HEIGHTS = [
  { id: "first", height: "h-[146px]" },
  { id: "second", height: "h-[146px]" },
  { id: "third", height: "h-[146px]" },
  { id: "fourth", height: "h-[146px]" },
  { id: "closed", height: "h-[103px]" },
];

function Bar({ className }: { className: string }) {
  return <div className={`rounded-control bg-line ${className}`} />;
}

export function FinderSkeleton() {
  return (
    <div
      role="group"
      aria-busy="true"
      aria-labelledby="courts-heading"
      className={FINDER_LAYOUT}
    >
      <div
        aria-hidden="true"
        className="grid min-w-0 gap-5 rounded-card bg-ground p-5 [@media(max-width:520px)]:p-3.5"
      >
        {PANEL_GROUPS.map((group) => (
          <div key={group}>
            <Bar className="mb-2 h-5 w-16" />
            <div className="h-[52px] rounded-xl border border-line bg-paper" />
          </div>
        ))}
        <div>
          <Bar className="mb-2.5 h-5 w-24" />
          {CHECK_ROWS.map((row) => (
            <div key={row} className="flex h-11 items-center">
              <Bar className="h-5 w-36" />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="min-w-0">
        <div className="flex h-11 items-center">
          <Bar className="h-5 w-44 max-w-full" />
        </div>
        <Bar className="mt-3 h-5 w-48 max-w-full" />
        <div className="mt-3 grid gap-3">
          {CARD_HEIGHTS.map(({ id, height }) => (
            <div
              key={id}
              className={`rounded-card border border-line bg-paper ${height}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
