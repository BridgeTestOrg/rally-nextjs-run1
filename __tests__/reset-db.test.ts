// @vitest-environment node
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { main, resetDatabase } from '../e2e/reset-db.mjs'

// Every filesystem change is mocked, so these tests never delete anything.
vi.mock('node:fs', () => ({ mkdirSync: vi.fn(), rmSync: vi.fn() }))

const root = path.resolve(import.meta.dirname, '..')

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('resetDatabase', () => {
  test('removes the database and its WAL and SHM files', () => {
    resetDatabase('test-results/e2e/default/rally.db')

    const file = path.join(root, 'test-results/e2e/default/rally.db')

    expect(vi.mocked(rmSync).mock.calls).toEqual([
      [file, { force: true }],
      [`${file}-wal`, { force: true }],
      [`${file}-shm`, { force: true }],
    ])
  })

  test('creates the parent folder', () => {
    resetDatabase('test-results/e2e/waitlist/rally.db')

    expect(mkdirSync).toHaveBeenCalledWith(
      path.join(root, 'test-results/e2e/waitlist'),
      { recursive: true },
    )
  })

  test('accepts an absolute path inside the allowed folder', () => {
    const file = path.join(root, 'test-results/e2e/default/rally.db')

    resetDatabase(file)

    expect(rmSync).toHaveBeenCalledWith(file, { force: true })
  })

  test.each([
    ['unset', undefined],
    ['empty', ''],
    ['the real database', 'data/rally.db'],
    ['a traversal path', 'test-results/e2e/../../data/rally.db'],
    ['a sibling with the same prefix', 'test-results/e2e-other/rally.db'],
    ['the allowed folder itself', 'test-results/e2e'],
    ['an absolute outside path', '/tmp/rally.db'],
  ])('refuses %s without touching the disk', (_name, databasePath) => {
    expect(() => resetDatabase(databasePath)).toThrow(/DATABASE_PATH/)
    expect(rmSync).not.toHaveBeenCalled()
    expect(mkdirSync).not.toHaveBeenCalled()
  })
})

describe('main', () => {
  test('returns 0 after a reset', () => {
    expect(main({ DATABASE_PATH: 'test-results/e2e/default/rally.db' })).toBe(0)
  })

  test('returns non-zero and explains a refused path', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(main({ DATABASE_PATH: 'data/rally.db' })).toBe(1)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('DATABASE_PATH'))
    expect(rmSync).not.toHaveBeenCalled()
  })

  test('returns non-zero when the variable is unset', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(main({})).toBe(1)
    expect(rmSync).not.toHaveBeenCalled()
  })
})
