export function SectionHeading({
  id,
  eyebrow,
  heading,
  tone = "light",
}: {
  id: string;
  eyebrow: string;
  heading: string;
  tone?: "light" | "dark";
}) {
  return (
    <div className={`rally-section-heading rally-section-heading--${tone}`}>
      <p className="rally-eyebrow">{eyebrow}</p>
      <h2 id={id} className="rally-section-heading__title">
        {heading}
      </h2>
    </div>
  );
}
