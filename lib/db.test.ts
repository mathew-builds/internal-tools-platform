import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { db } from "./db.ts";

describe("database handle", () => {
  it("waits for a contended write instead of failing with 'database is locked'", () => {
    const [row] = db.prepare("PRAGMA busy_timeout").all() as { timeout: number }[];
    assert.ok(row.timeout > 0, `expected a non-zero busy timeout, got ${row.timeout}`);
  });

  it("is in WAL mode", () => {
    const [row] = db.prepare("PRAGMA journal_mode").all() as { journal_mode: string }[];
    assert.equal(row.journal_mode, "wal");
  });
});
