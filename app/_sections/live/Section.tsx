import { SectionHeading } from "@/app/_components/SectionHeading";
import { content } from "@/lib/content";

export function LiveSection() {
  const { live } = content;

  return (
    <section
      id="live"
      aria-labelledby="live-heading"
      className="rally-section rally-section--ground"
    >
      <div className="rally-container">
        <SectionHeading
          id="live-heading"
          eyebrow={live.eyebrow}
          heading={live.heading}
        />
      </div>
    </section>
  );
}
