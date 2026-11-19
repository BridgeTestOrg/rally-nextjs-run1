import { Badge } from "@/app/_components/Badge";
import { Button } from "@/app/_components/Button";
import { content, fill } from "@/lib/content";
import type { WaitlistState } from "@/lib/waitlist";

type ResultState = Extract<WaitlistState, { status: "joined" | "duplicate" }>;

export function WaitlistResult({ state }: { state: ResultState }) {
  const { success, duplicate } = content.waitlist;

  if (state.status === "joined") {
    const { email, cityLabel, place } = state;

    return (
      <div className="rally-waitlist__card">
        <Badge variant="success">{success.badge}</Badge>
        <h3 className="rally-waitlist__result-title">
          {fill(success.title, { place, city: cityLabel })}
        </h3>
        <p className="rally-waitlist__result-body">
          {fill(success.body, { email })}
        </p>
        <Button
          variant="court"
          href="#courts"
          className="rally-waitlist__result-cta"
        >
          {success.cta}
        </Button>
      </div>
    );
  }

  const { email, cityLabel, date } = state;

  return (
    <div className="rally-waitlist__card">
      <Badge variant="duplicate">{duplicate.badge}</Badge>
      <h3 className="rally-waitlist__result-title">{duplicate.title}</h3>
      <p className="rally-waitlist__result-body">
        {fill(duplicate.body, { email, city: cityLabel, date })}
      </p>
    </div>
  );
}
