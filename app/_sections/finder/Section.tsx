import type { ReactElement } from "react";
import { SectionHeading } from "@/app/_components/SectionHeading";
import { content } from "@/lib/content";

type FinderSectionProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The Finder ticket reads searchParams. This shell accepts it and never awaits it.
export const FinderSection: (props: FinderSectionProps) => ReactElement = () => {
  const { finder } = content;

  return (
    <section
      id="courts"
      aria-labelledby="courts-heading"
      className="rally-section rally-section--paper"
    >
      <div className="rally-container">
        <SectionHeading
          id="courts-heading"
          eyebrow={finder.eyebrow}
          heading={finder.heading}
        />
      </div>
    </section>
  );
};
