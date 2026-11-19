import { connection } from 'next/server'
import { now } from '@/lib/clock'
import { courtsApi } from '@/lib/courts'
import { parseFilters } from '@/lib/filters'

export async function GET(request: Request) {
  await connection()
  const instant = now()
  const filters = parseFilters(new URL(request.url).searchParams)

  return Response.json(courtsApi(filters, instant), {
    headers: { 'Cache-Control': 'no-store' },
  })
}
