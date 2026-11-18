import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(scriptPath), '..')
const allowedRoot = path.join(repoRoot, 'test-results', 'e2e')

/**
 * Deletes an e2e database and its WAL and SHM files, then creates its folder.
 * Refuses any path outside test-results/e2e, which protects data/rally.db.
 */
export function resetDatabase(databasePath) {
  if (!databasePath) {
    throw new Error('DATABASE_PATH must be set to a file in test-results/e2e/.')
  }

  const resolved = path.resolve(repoRoot, databasePath)

  if (!resolved.startsWith(allowedRoot + path.sep)) {
    throw new Error(
      `DATABASE_PATH must be inside test-results/e2e/, got "${databasePath}".`,
    )
  }

  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(resolved + suffix, { force: true })
  }

  mkdirSync(path.dirname(resolved), { recursive: true })
}

/** @param {Record<string, string | undefined>} env */
export function main(env = process.env) {
  try {
    resetDatabase(env.DATABASE_PATH)
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  process.exit(main())
}
