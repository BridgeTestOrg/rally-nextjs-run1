// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest'
import courtsFile from '../data/courts.json'

type File = {
  openingHours: Record<string, Record<string, unknown>>
  courts: Record<string, unknown>[]
}

afterEach(() => {
  vi.doUnmock('@/data/courts.json')
  vi.resetModules()
})

async function loadWith(change: (file: File) => void) {
  const file = structuredClone(courtsFile) as unknown as File

  change(file)
  vi.resetModules()
  vi.doMock('@/data/courts.json', () => ({ default: file }))

  return import('../lib/courts')
}

describe('the real data file', () => {
  test('gives six courts in file order', async () => {
    const { getCourts } = await loadWith(() => undefined)

    expect(getCourts().map((court) => court.id)).toEqual([
      'northridge-park',
      'redstone-park',
      'ocean-park',
      'memorial-park',
      'pier-a-park',
      'church-square-park',
    ])
  })

  test('exports the opening hours', async () => {
    const { openingHours } = await loadWith(() => undefined)

    expect(openingHours).toEqual({
      withLights: { open: '07:00', close: '22:00' },
      withoutLights: { open: '07:00', close: '19:00' },
    })
  })

  test('hands out copies a caller cannot use to change the data', async () => {
    const { getCourts } = await loadWith(() => undefined)
    const courts = getCourts()

    courts[0].name = 'Changed'
    courts[0].slots.tue.push('23:00')
    courts.pop()

    expect(getCourts()).toHaveLength(6)
    expect(getCourts()[0].name).toBe('Northridge Park')
    expect(getCourts()[0].slots.tue).toEqual(['09:00', '18:00', '20:30'])
  })
})

describe('a malformed data file', () => {
  test.each<[string, (file: File) => void, RegExp]>([
    [
      'missing courts',
      (file) => Reflect.deleteProperty(file, 'courts'),
      /courts must be an array/,
    ],
    ['no courts', (file) => void (file.courts = []), /courts must be a non-empty/],
    [
      'a launch state with no court',
      (file) =>
        void (file.courts = file.courts.filter(({ state }) => state !== 'NJ')),
      /courts must be an array with a court in NJ/,
    ],
    [
      'a repeated id',
      (file) => void (file.courts[1].id = file.courts[0].id),
      /courts\[1\]\.id must be unique/,
    ],
    [
      'an unknown state',
      (file) => void (file.courts[0].state = 'TX'),
      /courts\[0\]\.state must be one of/,
    ],
    [
      'an unknown time zone',
      (file) => void (file.courts[2].timezone = 'Mars/Base'),
      /courts\[2\]\.timezone must be an IANA/,
    ],
    [
      'a latitude out of range',
      (file) => void (file.courts[0].lat = 91),
      /courts\[0\]\.lat must be between/,
    ],
    [
      'a text longitude',
      (file) => void (file.courts[0].lon = '-104'),
      /courts\[0\]\.lon must be a finite number/,
    ],
    [
      'a court count of zero',
      (file) => void (file.courts[0].courts = 0),
      /courts\[0\]\.courts must be a positive integer/,
    ],
    [
      'a text lights flag',
      (file) => void (file.courts[0].lights = 'yes'),
      /courts\[0\]\.lights must be a boolean/,
    ],
    [
      'a missing weekday',
      (file) =>
        Reflect.deleteProperty(file.courts[0].slots as object, 'sun'),
      /courts\[0\]\.slots\.sun must be an array/,
    ],
    [
      'an invalid slot time',
      (file) =>
        void ((file.courts[0].slots as Record<string, string[]>).mon = ['24:00']),
      /courts\[0\]\.slots\.mon\[0\] must be an HH:MM/,
    ],
    [
      'an impossible closure date',
      (file) =>
        void (file.courts[3].closures = [{ date: '2026-02-30', reason: 'x' }]),
      /courts\[3\]\.closures\[0\]\.date must be a real/,
    ],
    [
      'a closure with no reason',
      (file) =>
        void (file.courts[3].closures = [{ date: '2026-11-21', reason: '' }]),
      /courts\[3\]\.closures\[0\]\.reason must be a non-empty/,
    ],
    [
      'opening hours that differ from the schedule',
      (file) => void (file.openingHours.withLights.close = '21:00'),
      /openingHours\.withLights\.close must be "22:00"/,
    ],
    [
      'missing opening hours',
      (file) => Reflect.deleteProperty(file.openingHours, 'withoutLights'),
      /openingHours\.withoutLights must be an object/,
    ],
  ])('throws on load for %s', async (_name, change, message) => {
    await expect(loadWith(change)).rejects.toThrow(message)
  })
})
