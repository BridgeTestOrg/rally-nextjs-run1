import { content } from "@/lib/content";
import { Button } from "./Button";
import { CourtArt } from "./CourtArt";
import { HeroCard } from "./HeroCard";

export function Hero() {
  const { hero } = content;

  return (
    <section className="rally-hero">
      <div className="rally-container rally-hero__inner">
        <div className="rally-hero__copy">
          <p className="rally-eyebrow rally-hero__eyebrow">{hero.eyebrow}</p>
          <h1 className="rally-hero__headline">
            {hero.headline}{" "}
            <span className="rally-hero__accent">{hero.headlineAccent}</span>
          </h1>
          <p className="rally-hero__lead">{hero.lead}</p>
          <div className="rally-hero__actions">
            <Button variant="ball" href="#waitlist">
              {hero.primaryCta}
            </Button>
            <Button variant="ghost" href="#live">
              {hero.secondaryCta}
            </Button>
          </div>
        </div>
        <CourtArt label={hero.courtArtLabel}>
          <HeroCard card={hero.card} />
        </CourtArt>
      </div>
    </section>
  );
}
