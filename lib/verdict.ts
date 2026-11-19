export type Verdict = 'playable' | 'breezy' | 'not_today'

export function verdict({
  tempF,
  windMph,
  rainPct,
}: {
  tempF: number
  windMph: number
  rainPct: number
}): Verdict {
  if (windMph >= 18 || rainPct >= 60 || tempF < 40) {
    return 'not_today'
  }

  return windMph < 12 && rainPct < 30 ? 'playable' : 'breezy'
}
