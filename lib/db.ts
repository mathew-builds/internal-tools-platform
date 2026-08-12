import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export type Tx = DatabaseSync;

/**
 * A row of `_migrations`.
 */
type MigrationRow = { filename: string };

function open(): DatabaseSync {
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const handle = new DatabaseSync(path.join(dataDir, "app.db"));
  handle.exec("PRAGMA journal_mode = WAL");
  handle.exec("PRAGMA foreign_keys = ON");
  return handle;
}

/**
 * Applies every `migrations/NNNN_*.sql` file in filename order and records the
 * ones it applied. Runs on boot, on every boot: each file is idempotent and an
 * already-recorded file is skipped, so a dev-server reload is a no-op.
 */
function migrate(handle: DatabaseSync): void {
  handle.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
       filename   TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL
     )`,
  );

  const dir = path.join(process.cwd(), "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set(
    (handle.prepare("SELECT filename FROM _migrations").all() as MigrationRow[]).map(
      (r) => r.filename,
    ),
  );

  for (const filename of files) {
    if (applied.has(filename)) continue;
    handle.exec(fs.readFileSync(path.join(dir, filename), "utf8"));
    handle
      .prepare("INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)")
      .run(filename, new Date().toISOString());
  }
}

export const db: DatabaseSync = open();

migrate(db);

let depth = 0;

/**
 * Runs `fn` inside a transaction and hands it the handle to write through, so a
 * business row and its audit row commit together or not at all.
 */
export function withTransaction<T>(fn: (tx: Tx) => T): T {
  if (depth > 0) return fn(db);

  db.exec("BEGIN");
  depth = 1;
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    depth = 0;
  }
}
