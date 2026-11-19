import { content } from "@/lib/content";

const CARD_KEYS = ["first", "second", "third"];
const STAT_KEYS = ["temp", "wind", "rain"];

function Shimmer({ part }: { part: string }) {
  return <div className={`rally-live__shimmer rally-live__shimmer--${part}`} />;
}

function SkeletonCard() {
  return (
    <div className="rally-live__card-box">
      <Shimmer part="city" />
      <Shimmer part="time" />
      <Shimmer part="badge" />
      <div className="rally-live__divider" />
      <div className="rally-live__stats">
        {STAT_KEYS.map((key) => (
          <div key={key} className="rally-live__skeleton-stat">
            <Shimmer part="value" />
            <Shimmer part="label" />
          </div>
        ))}
      </div>
      <div className="rally-live__skeleton-next">
        <Shimmer part="next" />
      </div>
    </div>
  );
}

/** Holds the resolved region's stamp and card geometry while weather loads. */
export function LiveSkeleton() {
  return (
    <div className="rally-live__state" aria-busy="true">
      <p className="rally-live__stamp">{content.live.stampLoading}</p>
      <div className="rally-live__body">
        <div className="rally-live__grid" aria-hidden="true">
          {CARD_KEYS.map((key) => (
            <SkeletonCard key={key} />
          ))}
        </div>
      </div>
    </div>
  );
}
