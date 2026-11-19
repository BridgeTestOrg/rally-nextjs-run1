// @vitest-environment node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { content } from '../lib/content'
import { date } from '../lib/format'
import { migrate, openDb } from '../lib/db'
import {
  INSERT_SQL,
  join,
  validate,
  type ValidatedWaitlistValues,
  type WaitlistState,
} from '../lib/waitlist'

const { errors, cities } = content.waitlist
const INSTANT = new Date('2026-11-18T00:40:00.000Z')
const SAM: ValidatedWaitlistValues = {
  email: 'sam@example.com',
  city: 'highlands-ranch',
  level: 'mid',
}

let directory: string
let databasePath: string
const opened: DatabaseSync[] = []

function open() {
  const db = openDb(databasePath)

  opened.push(db)

  return db
}

function rows(db: DatabaseSync) {
  return db.prepare('SELECT email, city, level, created_at FROM waitlist').all()
}

function userVersion(db: DatabaseSync) {
  return db.prepare('PRAGMA user_version').get()?.user_version
}

/** Points the migration runner at a folder holding exactly these files. */
function useMigrations(files: Record<string, string>) {
  const root = path.join(directory, 'project')

  mkdirSync(path.join(root, 'migrations'), { recursive: true })

  for (const [name, sql] of Object.entries(files)) {
    writeFileSync(path.join(root, 'migrations', name), sql)
  }

  vi.spyOn(process, 'cwd').mockReturnValue(root)
}

/**
 * Runs `code` on `count` threads. Each thread signals that it is ready, then
 * blocks on a shared barrier, so they all start their work at the same moment.
 */
async function raceWorkers<T>(
  count: number,
  code: string,
  workerData: object,
): Promise<T[]> {
  const barrier = new SharedArrayBuffer(8)
  const flags = new Int32Array(barrier)
  const workers = Array.from(
    { length: count },
    () =>
      new Worker(
        `const { parentPort, workerData } = require('node:worker_threads');
         const flags = new Int32Array(workerData.barrier);
         const ready = () => {
           Atomics.add(flags, 0, 1);
           Atomics.notify(flags, 0);
           Atomics.wait(flags, 1, 0);
         };
         (async () => { ${code} })().then(
           (result) => parentPort.postMessage(result),
           (error) => { throw error; },
         );`,
        {
          eval: true,
          execArgv: ['--no-warnings'],
          workerData: { ...workerData, barrier },
        },
      ),
  )
  const results = workers.map(
    (worker) =>
      new Promise<T>((resolve, reject) => {
        worker.once('message', resolve)
        worker.once('error', reject)
      }),
  )

  try {
    while (Atomics.load(flags, 0) < count) {
      await new Promise((resolve) => setTimeout(resolve, 5))
    }

    Atomics.store(flags, 1, 1)
    Atomics.notify(flags, 1)

    return await Promise.all(results)
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()))
  }
}

beforeEach(() => {
  directory = mkdtempSync(path.join(os.tmpdir(), 'rally-waitlist-'))
  databasePath = path.join(directory, 'nested', 'rally.db')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()

  for (const db of opened.splice(0)) {
    if (db.isOpen) {
      db.close()
    }
  }

  rmSync(directory, { recursive: true, force: true })
})

describe('validate', () => {
  const valid = { email: 'sam@example.com', city: 'hoboken', level: 'pro' }

  test('accepts FormData and trims the email', () => {
    const form = new FormData()

    form.set('email', '  sam@example.com ')
    form.set('city', 'hoboken')
    form.set('level', 'pro')

    expect(validate(form)).toEqual({ ok: true, value: valid })
  })

  test('accepts a plain record', () => {
    expect(validate(valid)).toEqual({ ok: true, value: valid })
  })

  test.each(['sam@', 'sam', '@example.com', 'sam@example', 'a b@example.com', ''])(
    'rejects the email %j and keeps it',
    (email) => {
      expect(validate({ ...valid, email })).toEqual({
        ok: false,
        fieldErrors: { email: errors.email },
        values: { ...valid, email },
      })
    },
  )

  test('applies the 254 character limit to the trimmed email', () => {
    const domain = '@example.com'
    const longest = `${'a'.repeat(254 - domain.length)}${domain}`

    expect(validate({ ...valid, email: ` ${longest} ` }).ok).toBe(true)
    expect(validate({ ...valid, email: `a${longest}` })).toMatchObject({
      ok: false,
      fieldErrors: { email: errors.email },
    })
  })

  test.each([
    ['city', 'denver', errors.city],
    ['city', '', errors.city],
    ['level', 'expert', errors.level],
    ['level', '', errors.level],
  ])('rejects %s %j', (field, value, message) => {
    expect(validate({ ...valid, [field]: value })).toEqual({
      ok: false,
      fieldErrors: { [field]: message },
      values: { ...valid, [field]: value },
    })
  })

  test('reports every problem and keeps the raw values', () => {
    const values = { email: ' nope ', city: 'x', level: 'y' }

    expect(validate(values)).toEqual({
      ok: false,
      fieldErrors: {
        email: errors.email,
        city: errors.city,
        level: errors.level,
      },
      values,
    })
  })

  test('treats missing and non-string values as empty', () => {
    expect(validate({ email: 42, level: ['new'] })).toMatchObject({
      ok: false,
      values: { email: '', city: '', level: '' },
    })
  })
})

describe('migrations', () => {
  test('a new database reaches version 1 with its table and index', () => {
    const db = open()
    const schema = db
      .prepare("SELECT type, name FROM sqlite_master WHERE tbl_name = 'waitlist'")
      .all()

    expect(userVersion(db)).toBe(1)
    expect(schema).toContainEqual({ type: 'table', name: 'waitlist' })
    expect(schema).toContainEqual({ type: 'index', name: 'waitlist_city' })
  })

  test('opening again changes nothing', () => {
    open().close()

    const db = open()

    migrate(db)

    expect(userVersion(db)).toBe(1)
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS tables FROM sqlite_master WHERE type = 'table' AND name = 'waitlist'",
        )
        .get()?.tables,
    ).toBe(1)
  })

  test.each([
    ['city', ['a@example.com', 'denver', 'new', 'now']],
    ['level', ['a@example.com', 'hoboken', 'expert', 'now']],
  ])('the table rejects an unknown %s', (_field, values) => {
    const db = open()

    expect(() =>
      db
        .prepare(
          'INSERT INTO waitlist (email, city, level, created_at) VALUES (?, ?, ?, ?)',
        )
        .run(...values),
    ).toThrow(/CHECK constraint/)
  })

  test('applies files in numeric order and ignores other names', () => {
    useMigrations({
      '1000_last.sql': "INSERT INTO log VALUES ('1000');",
      '9_first.sql': 'CREATE TABLE log (name TEXT);',
      '010_middle.sql': "INSERT INTO log VALUES ('10');",
      'notes.sql': 'THIS IS NOT SQL;',
    })

    const db = open()

    expect(db.prepare('SELECT name FROM log').all()).toEqual([
      { name: '10' },
      { name: '1000' },
    ])
    expect(userVersion(db)).toBe(1000)
  })

  test('rolls back every change when a migration fails', () => {
    useMigrations({
      '001_good.sql': 'CREATE TABLE kept (id INTEGER);',
      '002_bad.sql': 'THIS IS NOT SQL;',
    })

    const db = new DatabaseSync(path.join(directory, 'manual.db'))

    opened.push(db)

    expect(() => migrate(db)).toThrow(/syntax error/)
    expect(db.isTransaction).toBe(false)
    expect(userVersion(db)).toBe(0)
    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE name = 'kept'").get(),
    ).toBeUndefined()
  })

  test.each([
    ['is empty', () => useMigrations({})],
    [
      'is missing',
      () => {
        vi.spyOn(process, 'cwd').mockReturnValue(directory)
      },
    ],
  ])('fails when the migrations folder %s', (_name, arrange) => {
    arrange()

    expect(() => openDb(databasePath)).toThrow(/version 1 is required/)
  })

  test('an already migrated database opens without the folder', () => {
    open().close()
    vi.spyOn(process, 'cwd').mockReturnValue(directory)

    expect(userVersion(open())).toBe(1)
  })

  test('a failed open closes its handle and keeps the original error', () => {
    useMigrations({ '001_bad.sql': 'THIS IS NOT SQL;' })

    const close = vi
      .spyOn(DatabaseSync.prototype, 'close')
      .mockImplementationOnce(() => {
        throw new Error('close failed')
      })

    expect(() => openDb(databasePath)).toThrow(/syntax error/)
    expect(close).toHaveBeenCalledOnce()
  })

  test('processes opening a new database together migrate it once', async () => {
    const versions = await raceWorkers<number>(
      8,
      `const { openDb } = await import(workerData.dbModule);
       ready();
       const db = openDb(workerData.databasePath);
       const version = db.prepare('PRAGMA user_version').get().user_version;
       db.close();
       return version;`,
      {
        databasePath,
        dbModule: pathToFileURL(path.resolve('lib/db.ts')).href,
      },
    )

    expect(versions).toEqual(Array(8).fill(1))
    expect(userVersion(open())).toBe(1)
  }, 30_000)
})

describe('getDb', () => {
  test('reuses one connection', () => {
    vi.resetModules()
    vi.stubEnv('DATABASE_PATH', databasePath)

    return import('../lib/db').then(({ getDb: freshGetDb }) => {
      const db = freshGetDb()

      opened.push(db)

      expect(freshGetDb()).toBe(db)
    })
  })

  test('tries again after a failed open', async () => {
    const blocker = path.join(directory, 'blocker')

    writeFileSync(blocker, '')
    vi.resetModules()
    vi.stubEnv('DATABASE_PATH', path.join(blocker, 'rally.db'))

    const { getDb: freshGetDb } = await import('../lib/db')

    expect(() => freshGetDb()).toThrow()

    vi.stubEnv('DATABASE_PATH', databasePath)

    const db = freshGetDb()

    opened.push(db)

    expect(userVersion(db)).toBe(1)
  })

  test('importing the module opens nothing', async () => {
    vi.resetModules()
    vi.stubEnv('DATABASE_PATH', databasePath)

    await import('../lib/db')

    expect(existsSync(path.dirname(databasePath))).toBe(false)
  })
})

describe('join', () => {
  test('counts places per city', () => {
    const db = open()
    const places = [
      join({ ...SAM, email: 'a@example.com' }, INSTANT, db),
      join({ ...SAM, email: 'b@example.com' }, INSTANT, db),
      join({ ...SAM, email: 'c@example.com', city: 'santa-monica' }, INSTANT, db),
    ]

    expect(places).toEqual([
      { kind: 'joined', city: 'highlands-ranch', place: 1 },
      { kind: 'joined', city: 'highlands-ranch', place: 2 },
      { kind: 'joined', city: 'santa-monica', place: 1 },
    ])
  })

  test('stores the normalized email and the given instant', () => {
    const db = open()

    join({ ...SAM, email: '  Sam@Example.COM ' }, INSTANT, db)

    expect(rows(db)).toEqual([
      {
        email: 'sam@example.com',
        city: 'highlands-ranch',
        level: 'mid',
        created_at: '2026-11-18T00:40:00.000Z',
      },
    ])
  })

  test('a duplicate returns the first row and leaves it unchanged', () => {
    const db = open()

    join(SAM, INSTANT, db)

    const before = rows(db)
    const result = join(
      { email: ' SAM@example.com ', city: 'hoboken', level: 'pro' },
      new Date('2027-01-01T00:00:00.000Z'),
      db,
    )

    expect(result).toEqual({
      kind: 'duplicate',
      city: 'highlands-ranch',
      createdAt: '2026-11-18T00:40:00.000Z',
    })
    expect(rows(db)).toEqual(before)
  })

  test('rolls back and rethrows when the insert fails', () => {
    const db = open()
    const invalid = { ...SAM, city: 'denver' } as unknown as ValidatedWaitlistValues

    expect(() => join(invalid, INSTANT, db)).toThrow(/CHECK constraint/)
    expect(db.isTransaction).toBe(false)
    expect(join(SAM, INSTANT, db)).toMatchObject({ kind: 'joined', place: 1 })
  })

  test('leaves the connection open for its owner', () => {
    const db = open()

    join(SAM, INSTANT, db)

    expect(db.isOpen).toBe(true)
  })

  test('20 simultaneous inserts store one row', async () => {
    open().close()

    const inserted = await raceWorkers<boolean>(
      20,
      `const { DatabaseSync } = require('node:sqlite');
       const db = new DatabaseSync(workerData.databasePath);
       db.exec('PRAGMA busy_timeout=5000');
       const insert = db.prepare(workerData.sql);
       ready();
       db.exec('BEGIN IMMEDIATE');
       const row = insert.get(...workerData.values);
       db.exec('COMMIT');
       db.close();
       return row !== undefined;`,
      {
        databasePath,
        sql: INSERT_SQL,
        values: [SAM.email, SAM.city, SAM.level, INSTANT.toISOString()],
      },
    )

    expect(inserted.filter(Boolean)).toHaveLength(1)
    expect(rows(open())).toHaveLength(1)
  }, 30_000)
})

describe('joinWaitlist', () => {
  const idle: WaitlistState = { status: 'idle' }

  function form(values: Record<string, string>) {
    const data = new FormData()

    for (const [name, value] of Object.entries(values)) {
      data.set(name, value)
    }

    return data
  }

  const valid = { email: ' Sam@Example.com ', city: 'hoboken', level: 'new' }

  /** A fresh action module, so its shared connection uses this test's file. */
  async function loadAction() {
    vi.resetModules()
    vi.stubEnv('DATABASE_PATH', databasePath)

    const [{ joinWaitlist }, db] = await Promise.all([
      import('../app/_sections/waitlist/actions'),
      import('../lib/db'),
    ])

    return { joinWaitlist, getDb: db.getDb }
  }

  async function loadOpenAction() {
    const loaded = await loadAction()

    opened.push(loaded.getDb())

    return loaded.joinWaitlist
  }

  test('returns field errors without touching the database', async () => {
    const { joinWaitlist } = await loadAction()
    const values = { email: 'sam@', city: 'hoboken', level: 'new' }

    await expect(joinWaitlist(idle, form(values))).resolves.toEqual({
      status: 'error',
      fieldErrors: { email: errors.email },
      values,
    })
    expect(existsSync(databasePath)).toBe(false)
  })

  test('a join reports the place and full city label', async () => {
    vi.stubEnv('RALLY_NOW', '2026-11-17T17:40:00-07:00')

    const joinWaitlist = await loadOpenAction()

    await expect(joinWaitlist(idle, form(valid))).resolves.toEqual({
      status: 'joined',
      email: 'Sam@Example.com',
      cityLabel: cities.hoboken,
      place: 1,
    })
  })

  test('takes created_at from the fixed clock', async () => {
    vi.stubEnv('RALLY_NOW', '2026-11-17T17:40:00-07:00')

    const { joinWaitlist, getDb: sharedDb } = await loadAction()

    opened.push(sharedDb())
    await joinWaitlist(idle, form(valid))

    expect(rows(sharedDb())[0]?.created_at).toBe('2026-11-18T00:40:00.000Z')
  })

  test('a duplicate uses the stored city and its local date', async () => {
    // 00:30 on 18 Nov in Hoboken is still 17 Nov in Santa Monica.
    vi.stubEnv('RALLY_NOW', '2026-11-18T05:30:00Z')

    const joinWaitlist = await loadOpenAction()

    await joinWaitlist(idle, form(valid))

    vi.stubEnv('RALLY_NOW', '2026-12-25T12:00:00Z')

    await expect(
      joinWaitlist(
        idle,
        form({ email: 'sam@example.com', city: 'santa-monica', level: 'pro' }),
      ),
    ).resolves.toEqual({
      status: 'duplicate',
      email: 'sam@example.com',
      cityLabel: cities.hoboken,
      date: '18 Nov',
    })
  })

  test('the ticket example formats as 17 Nov in Denver', () => {
    expect(date(new Date('2026-11-17T17:40:00-07:00'), 'America/Denver')).toBe(
      '17 Nov',
    )
  })

  test('a database failure returns the generic error and logs no details', async () => {
    const blocker = path.join(directory, 'blocker')

    writeFileSync(blocker, '')

    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { joinWaitlist } = await loadAction()

    vi.stubEnv('DATABASE_PATH', path.join(blocker, 'rally.db'))

    await expect(joinWaitlist(idle, form(valid))).resolves.toEqual({
      status: 'error',
      fieldErrors: {},
      values: valid,
      serverError: errors.server,
    })
    expect(log.mock.calls).toEqual([['waitlist join failed']])
  })
})
