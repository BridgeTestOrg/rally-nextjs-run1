const STATES = ['all', 'CO', 'CA', 'NJ'] as const
const DAYS = ['today', 'tomorrow', 'sat'] as const
const TIMES = ['any', 'am', 'pm', 'eve'] as const

export type Filters = {
  state: (typeof STATES)[number]
  day: (typeof DAYS)[number]
  time: (typeof TIMES)[number]
  lights: boolean
  parking: boolean
}

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>

function reader(params: RawParams): (name: string) => string | undefined {
  if (params instanceof URLSearchParams) {
    return (name) => params.get(name) ?? undefined
  }

  return (name) => {
    const value = Object.hasOwn(params, name) ? params[name] : undefined

    return Array.isArray(value) ? value[0] : value
  }
}

function oneOf<T extends string>(
  allowed: readonly T[],
  value: string | undefined,
): T {
  return allowed.find((option) => option === value) ?? allowed[0]
}

/** Reads finder filters. Each missing or invalid value gets its own default. */
export function parseFilters(params: RawParams): Filters {
  const read = reader(params)

  return {
    state: oneOf(STATES, read('state')),
    day: oneOf(DAYS, read('day')),
    time: oneOf(TIMES, read('time')),
    lights: read('lights') === '1',
    parking: read('parking') === '1',
  }
}

/** Whether a local `HH:MM` start falls in a time-of-day filter. */
export function inTimeBucket(hhmm: string, time: Filters['time']): boolean {
  switch (time) {
    case 'am':
      return hhmm < '12:00'
    case 'pm':
      return hhmm >= '12:00' && hhmm < '17:00'
    case 'eve':
      return hhmm >= '17:00'
    case 'any':
      return true
  }
}
