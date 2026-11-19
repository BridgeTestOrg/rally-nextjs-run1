import { connection } from 'next/server'
import { now } from '@/lib/clock'
import { getConditions } from '@/lib/conditions'

export async function GET() {
  await connection()
  const instant = now()
  const conditions = await getConditions(instant)

  return Response.json(
    conditions.map((entry) => ({
      city: entry.city,
      state: entry.state,
      available: entry.available,
      nextOpen: entry.nextOpen && {
        courtId: entry.nextOpen.courtId,
        time: entry.nextOpen.time,
      },
      tempF: entry.tempF,
      windMph: entry.windMph,
      rainPct: entry.rainPct,
      verdict: entry.verdict,
      updatedAt: entry.updatedAt,
    })),
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
