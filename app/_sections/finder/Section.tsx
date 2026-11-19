import { Suspense, type ReactElement } from "react";
import { SectionHeading } from "@/app/_components/SectionHeading";
import { content } from "@/lib/content";
import { FinderBody } from "./FinderBody";
import { FinderSkeleton } from "./FinderSkeleton";

type FinderSectionProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The heading is static. Everything that reads the request sits inside Suspense.
export const FinderSection: (props: FinderSectionProps) => ReactElement = ({
  searchParams,
}) => {
  const { finder } = content;

  return (
    <section
      id="courts"
      aria-labelledby="courts-heading"
      className="rally-section rally-section--paper"
    >
      <div className="rally-container">
        {/* The comps set this heading slightly looser than the shared default. */}
        <div className="[&_.rally-eyebrow]:leading-[1.55] [&_.rally-section-heading__title]:mt-3">
          <SectionHeading
            id="courts-heading"
            eyebrow={finder.eyebrow}
            heading={finder.heading}
          />
        </div>
        <Suspense fallback={<FinderSkeleton />}>
          <FinderBody searchParams={searchParams} />
        </Suspense>
      </div>
    </section>
  );
};
