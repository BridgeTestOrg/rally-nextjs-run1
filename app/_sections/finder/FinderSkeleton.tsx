/** The filter and results columns, shared so loading does not shift the page. */
export const FINDER_LAYOUT =
  "mt-7 grid grid-cols-[360px_minmax(0,1fr)] items-start gap-7 [@media(max-width:1024px)]:grid-cols-[minmax(0,1fr)]";

/**
 * Without JavaScript, React cannot swap streamed content into the Suspense
 * boundary: the finished finder stays in a hidden element at the end of <body>.
 * These rules show that element and place it where the skeleton was. The display
 * rule sits in an early layer because Tailwind's reset hides [hidden] with a
 * layered !important, which only an earlier layer can override.
 */
const NO_SCRIPT_CSS = `
@layer theme {
  body > div[hidden]:has(> [data-finder-body]) { display: flow-root !important; }
}
body { display: flex; flex-direction: column; }
body > * { min-width: 0; }
main { display: contents; }
#courts { padding-bottom: 0; }
#courts [aria-busy] { display: none; }
#courts ~ section, body > footer { order: 2; }
body > div:has(> [data-finder-body]) {
  order: 1;
  padding-bottom: var(--spacing-section);
  background: var(--color-paper);
}
[data-finder-body] {
  box-sizing: border-box;
  width: 100%;
  max-width: var(--container-page);
  margin-inline: auto;
  padding-inline: var(--spacing-gutter);
}
@media (max-width: 768px) {
  body > div:has(> [data-finder-body]) { padding-bottom: 56px; }
}
@media (max-width: 520px) {
  [data-finder-body] { padding-inline: 16px; }
}
`;

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
      <noscript>
        <style dangerouslySetInnerHTML={{ __html: NO_SCRIPT_CSS }} />
      </noscript>
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
