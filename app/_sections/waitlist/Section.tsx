import { SectionHeading } from "@/app/_components/SectionHeading";
import { content } from "@/lib/content";

export function WaitlistSection() {
  const { waitlist } = content;

  return (
    <section
      id="waitlist"
      aria-labelledby="waitlist-heading"
      className="rally-section rally-section--court"
    >
      <div className="rally-container">
        <SectionHeading
          id="waitlist-heading"
          eyebrow={waitlist.eyebrow}
          heading={waitlist.heading}
          tone="dark"
        />
      </div>
    </section>
  );
}
