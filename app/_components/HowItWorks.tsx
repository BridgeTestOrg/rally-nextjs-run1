import { content } from "@/lib/content";
import { SectionHeading } from "./SectionHeading";

export function HowItWorks() {
  const { how } = content;

  return (
    <section
      id="how"
      aria-labelledby="how-heading"
      className="rally-section rally-section--ground"
    >
      <div className="rally-container">
        <SectionHeading
          id="how-heading"
          eyebrow={how.eyebrow}
          heading={how.heading}
        />
        <ol className="rally-steps">
          {how.steps.map((step, index) => (
            <li key={step.title} className="rally-step">
              <span className="rally-step__number">{index + 1}</span>
              <h3 className="rally-step__title">{step.title}</h3>
              <p className="rally-step__body">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
