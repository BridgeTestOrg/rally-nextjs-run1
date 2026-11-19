import { connection } from "next/server";
import { now } from "@/lib/clock";
import { getConditions, type ConditionsEntry } from "@/lib/conditions";
import { LiveCard } from "./LiveCard";
import { Notice } from "./Notice";
import { allWeatherFailed, lastCheckedText, stampText } from "./stamp";

/**
 * The request-time part of the live section. `getConditions` contains weather
 * failures itself, so a rejection here is unexpected. It is reported and shown
 * as the every-city notice, because nothing above this catches a render error.
 */
export async function LiveCards() {
  await connection();

  const instant = now();
  let entries: ConditionsEntry[] | null = null;

  try {
    entries = await getConditions(instant);
  } catch (error) {
    console.error("Live conditions could not be loaded.", error);
  }

  const showNotice = entries === null || allWeatherFailed(entries);
  const stamp =
    entries === null
      ? lastCheckedText(instant, instant)
      : stampText(entries, instant);
  const hasWeather = entries?.some(({ available }) => available) ?? false;

  return (
    <div className="rally-live__state" aria-busy="false">
      <p className="rally-live__stamp">
        {hasWeather ? (
          <span className="rally-live__dot" aria-hidden="true" />
        ) : null}
        <span>{stamp}</span>
      </p>
      <div className="rally-live__body">
        {showNotice ? (
          <Notice />
        ) : (
          <div className="rally-live__grid">
            {entries?.map((entry) => (
              <LiveCard key={entry.state} entry={entry} instant={instant} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
