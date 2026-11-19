import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/** The lowest schema this code can run against, whatever is on disk. */
const REQUIRED_SCHEMA_VERSION = 1;

const MIGRATION_FILE = /^(\d+)_.+\.sql$/;

const BUSY_TIMEOUT_MS = 5000;
const WAL_RETRY_DELAY_MS = 10;
const SQLITE_BUSY = 5;

type Migration = { version: number; file: string };

function listMigrations(directory: string): Migration[] {
  let names: string[];

  try {
    names = readdirSync(directory);
  } catch (error) {
    // A missing folder is reported by the schema floor check, and only matters
    // for a database that still needs migrating.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return names
    .flatMap((name) => {
      const match = MIGRATION_FILE.exec(name);

      return match
        ? [{ version: Number(match[1]), file: path.join(directory, name) }]
        : [];
    })
    .sort((a, b) => a.version - b.version);
}

function closeQuietly(db: DatabaseSync) {
  try {
    db.close();
  } catch {
    // The failure that led here is the one worth reporting.
  }
}

function isBusy(error: unknown) {
  const code = (error as { errcode?: unknown }).errcode;

  // The low byte of an extended SQLite result code is its primary code.
  return typeof code === "number" && (code & 0xff) === SQLITE_BUSY;
}

/**
 * SQLite does not apply `busy_timeout` to the switch into WAL mode, so processes
 * opening a new file together retry here, within the same time budget.
 */
function enableWal(db: DatabaseSync) {
  const pause = new Int32Array(new SharedArrayBuffer(4));

  for (let waited = 0; ; waited += WAL_RETRY_DELAY_MS) {
    try {
      db.exec("PRAGMA journal_mode=WAL");
      return;
    } catch (error) {
      if (!isBusy(error) || waited >= BUSY_TIMEOUT_MS) {
        throw error;
      }

      Atomics.wait(pause, 0, 0, WAL_RETRY_DELAY_MS);
    }
  }
}

/**
 * Runs `work` inside `BEGIN IMMEDIATE`, committing when it returns and rolling
 * back when anything throws. The original error always reaches the caller.
 */
export function immediateTransaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");

  try {
    const result = work();

    db.exec("COMMIT");

    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // The failure that led here is the one worth reporting.
    }

    throw error;
  }
}

/**
 * Applies every `migrations/NNN_*.sql` newer than `PRAGMA user_version`, in
 * numeric order. The write lock is taken before the version is read, so a
 * second process waits and then finds nothing left to do.
 */
export function migrate(db: DatabaseSync): void {
  const migrations = listMigrations(path.join(process.cwd(), "migrations"));

  immediateTransaction(db, () => {
    const row = db.prepare("PRAGMA user_version").get();
    let version = Number(row?.user_version);

    for (const migration of migrations) {
      if (migration.version > version) {
        db.exec(readFileSync(migration.file, "utf8"));
        db.exec(`PRAGMA user_version = ${migration.version}`);
        version = migration.version;
      }
    }

    if (!(version >= REQUIRED_SCHEMA_VERSION)) {
      throw new Error(
        `Database schema is at version ${version}, and version ${REQUIRED_SCHEMA_VERSION} is required.`,
      );
    }
  });
}

/**
 * Opens a migrated connection. The caller owns the handle and closes it. If
 * setup fails, the handle is closed here and the original error is rethrown.
 */
export function openDb(databasePath: string): DatabaseSync {
  mkdirSync(path.dirname(databasePath), { recursive: true });

  const db = new DatabaseSync(databasePath);

  try {
    // First, so the statements after it wait for locks instead of failing.
    db.exec(`PRAGMA busy_timeout=${BUSY_TIMEOUT_MS}`);
    enableWal(db);
    migrate(db);

    return db;
  } catch (error) {
    closeQuietly(db);

    throw error;
  }
}

let shared: DatabaseSync | undefined;

/**
 * The process-wide connection, opened on first use and kept for the life of the
 * process. A failed open leaves nothing behind, so the next call tries again.
 */
export function getDb(): DatabaseSync {
  shared ??= openDb(process.env.DATABASE_PATH ?? "data/rally.db");

  return shared;
}
