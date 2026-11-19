import { SectionHeading } from "@/app/_components/SectionHeading";
import { content } from "@/lib/content";
import { WaitlistForm } from "./WaitlistForm";
import "./waitlist.css";

function PerkCheck() {
  return (
    <svg
      className="rally-waitlist__check"
      viewBox="0 0 22 22"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="11" fill="var(--color-ball)" />
      <path
        d="M6.5 11.5l3 3 6-6.5"
        fill="none"
        stroke="var(--color-court)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WaitlistSection() {
  const { waitlist } = content;

  return (
    <section
      id="waitlist"
      aria-labelledby="waitlist-heading"
      className="rally-section rally-section--court"
    >
      <div className="rally-container rally-waitlist__layout">
        <div className="rally-waitlist__intro">
          <SectionHeading
            id="waitlist-heading"
            eyebrow={waitlist.eyebrow}
            heading={waitlist.heading}
            tone="dark"
          />
          <p className="rally-waitlist__lead">{waitlist.lead}</p>
          <ul className="rally-waitlist__perks">
            {waitlist.perks.map((perk) => (
              <li key={perk} className="rally-waitlist__perk">
                <PerkCheck />
                {perk}
              </li>
            ))}
          </ul>
        </div>
        <div className="rally-waitlist__action">
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}
