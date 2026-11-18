"use client";

import { useSyncExternalStore } from "react";
import type { content } from "@/lib/content";
import { Badge } from "./Badge";

type HeroCardContent = (typeof content)["hero"]["card"];
type NearbyCity = { name: string; line: string };

// The time zone does not change during a visit, so there is nothing to observe.
function subscribe() {
  return () => {};
}

function getSnapshot(): string | null {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function getServerSnapshot(): string | null {
  return null;
}

export function HeroCard({ card }: { card: HeroCardContent }) {
  const timeZone = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const cities: Record<string, NearbyCity> = card.byTimeZone;
  const nearby =
    timeZone !== null && Object.hasOwn(cities, timeZone)
      ? cities[timeZone]
      : null;
  const shown = nearby
    ? { badge: card.nearYouBadge, ...nearby }
    : card.default;

  return (
    <div className="rally-hero-card">
      <Badge variant="success">{shown.badge}</Badge>
      <div className="rally-hero-card__text">
        <p className="rally-hero-card__name">{shown.name}</p>
        <p className="rally-hero-card__line">{shown.line}</p>
      </div>
    </div>
  );
}
