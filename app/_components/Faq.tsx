import { content } from "@/lib/content";
import { SectionHeading } from "./SectionHeading";

export function Faq() {
  const { faq } = content;

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="rally-section rally-section--paper"
    >
      <div className="rally-container">
        <SectionHeading
          id="faq-heading"
          eyebrow={faq.eyebrow}
          heading={faq.heading}
        />
        <div className="rally-faq">
          {faq.items.map((item) => (
            <details key={item.q} className="rally-faq__item">
              <summary className="rally-faq__question">{item.q}</summary>
              <p className="rally-faq__answer">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
