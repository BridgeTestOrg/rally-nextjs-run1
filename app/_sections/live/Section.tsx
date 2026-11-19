import { Suspense } from "react";
import { SectionHeading } from "@/app/_components/SectionHeading";
import { content } from "@/lib/content";
import { LiveCards } from "./LiveCards";
import { LiveSkeleton } from "./LiveSkeleton";
import "./live.module.css";

export function LiveSection() {
  const { live } = content;

  return (
    <section
      id="live"
      aria-labelledby="live-heading"
      className="rally-section rally-section--ground"
    >
      <div className="rally-container rally-live">
        <div className="rally-live__heading">
          <SectionHeading
            id="live-heading"
            eyebrow={live.eyebrow}
            heading={live.heading}
          />
        </div>
        <div className="rally-live__region" aria-live="polite">
          <Suspense fallback={<LiveSkeleton />}>
            <LiveCards />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
