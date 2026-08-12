# AGENTS.md

Internal tools platform. A small set of reviewable back-office queues sharing one governed
foundation: authentication, role-based access control, an append-only audit log, and maker-checker
approval.

The point of this codebase is that the **foundation is written once** and every queue consumes it.
Adding a queue must never mean re-implementing auth, roles, audit or approval.

## Stack

- Next.js (App Router) + TypeScript
- SQLite, accessed through hand-written SQL, using Node's built-in `node:sqlite` module. Import it as
  `const { DatabaseSync } = require('node:sqlite')`, or `import { DatabaseSync } from 'node:sqlite'`.
  It needs no install and no native build. On Node 22 it prints an `ExperimentalWarning` on startup.
  That is expected. Do not suppress it.
- Tailwind for styling
- One process. `npm install && npm run dev` and nothing else.

## Hard prohibitions

- **Do not remove `agentRules: false` from `next.config.ts`.** Without it, `next dev` injects a managed
  block into `AGENTS.md` on every run and dirties the working tree. Do not create a `CLAUDE.md`.
- **No ORM in this repo. Do not add Prisma, Drizzle, Kysely or TypeORM.** Data access is hand-written
  SQL through `lib/db.ts`, so the append-only triggers are visible in the migration diff rather than
  behind generated client code. Prisma in particular adds a `postinstall` generate step, which is a
  cold-clone failure point this repo cannot afford.
- **No new external services.** No Docker, no database server, no hosted anything, no environment
  variables. If a change would require the reader to install or sign up for something, do not make it.
- **No `runtime = 'edge'`.** SQLite is not available there.
- **Do not alter existing tables in a new migration.** Migrations are additive only. Never modify
  `audit_log`.

## Module map

These paths and exports are fixed. Build them as separate modules with these public APIs. Other code
imports them; nothing re-implements them.

| Path | Exports |
|---|---|
| `lib/db.ts` | `db`, `withTransaction(fn)` |
| `lib/auth.ts` | `getCurrentUser()` |
| `lib/rbac.ts` | `can(user, action, resource)`, `requireRole(role)` |
| `lib/audit.ts` | `appendAudit({ actor, action, entity, entityId, payload }, tx)` |
| `lib/maker-checker.ts` | `assertDifferentActor(record, user)` |
| `lib/nav.ts` | an array of nav entries, not hardcoded JSX in the layout |

**Build order: these six modules first, with their public APIs, then the refunds queue as a consumer
of them.** Do not build the refunds queue monolithically and extract shared code afterwards.

`assertDifferentActor` must live in its own module and be called by every approval path. It must not
be inlined into a queue's approve action.

## Data layer

- Migrations are numbered plain-SQL files in `migrations/`: `0001_init.sql`, `0002_refunds.sql`, and
  so on. A runner applies them in order and records applied filenames in a `_migrations` table.
- **The runner executes on server boot**, creates the `data/` directory and the database file if they
  are absent, and is safe to run every time. There is no manual migrate step, ever. A reader who
  clones the repo and runs the dev server gets a working database.
- Use `CREATE TABLE IF NOT EXISTS` and `CREATE TRIGGER IF NOT EXISTS` so a dev-server reload does not
  throw on re-execution.
- The database path is `path.join(process.cwd(), 'data', 'app.db')`. **Never an absolute path.**
- **All ids are TEXT**, in every table and in the session user. Never mix TEXT and INTEGER ids.
  Comparisons like `record.requested_by === user.id` must not be defeated by type coercion.

### The audit log

`audit_log` is append-only, enforced by the database:

```sql
CREATE TRIGGER IF NOT EXISTS audit_log_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only: UPDATE denied'); END;

CREATE TRIGGER IF NOT EXISTS audit_log_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only: DELETE denied'); END;
```

**Every state change writes its business row and its audit row inside the same transaction**, via
`withTransaction`. A business write that succeeds without its audit row is a defect, not an edge case.

## Auth and roles

Authentication is a deliberate stub: a role switcher backed by a cookie. Real identity here would be
an SSO integration, which is out of scope for this codebase.

`getCurrentUser()` reads the cookie on every request. In the App Router, `cookies()` is async, so it
must be awaited. Because every page reads it, every page is dynamic; add
`export const dynamic = 'force-dynamic'` to queue pages as a belt.

Roles: `requester`, `approver`, `auditor`. `auditor` reads the queues and the audit log and can act on
nothing.

**An approver may also raise a request. That is precisely why maker-checker exists**, and without it no
user in this app could ever produce the state the rule guards against.

**Maker-checker is enforced when an approval is submitted, never by hiding rows or disabling the
control.** Every record stays visible and openable to any role that can open the queue, including a
record the current user requested. A rule enforced by hiding the button cannot be demonstrated, cannot
be tested, and is not a control.

## Adding a new queue

A queue is a set of records that move through `pending` to `approved` or `rejected`, where the person
who requested a change cannot be the person who approves it.

To add one:

1. A migration adding the table.
2. A route folder with list, detail, and the request, approve and reject server actions.
3. An entry in `lib/nav.ts`.

The queue imports `getCurrentUser`, `can`, `appendAudit` and `assertDifferentActor`. It does not
reimplement any of them. If you find yourself copying one of those modules instead of importing it,
stop and import it.

**Out of scope for this pattern:** any queue whose records need document upload, document storage or
a retention policy. Those requirements sit outside this foundation and are not made cheap by it. Say
so and stop rather than building a partial version.

## Testing

Tests live alongside the code and run with `node --test`, Node's built-in test runner. It requires no
install, which keeps the cold-clone contract below intact. Two assertions are required for every
queue:

- a role without approval rights cannot approve a record
- **an approver cannot approve a record they themselves requested** (the maker-checker rule; note this
  is a different assertion from the one above, and only this one exercises `assertDifferentActor`)
- an approver **can** approve a record someone else requested

The third is not padding. Without it the first two both pass on an approve path that refuses everyone.
Tests construct their own records; they must not approve the seeded demo records, or the demo no longer
reproduces on the machine the recording is made on.

Run `node --test` before opening a pull request. Do not add `npm run build` to that gate.

## Seed data

On first boot, seed three users covering the three roles and six to ten refund records in mixed states,
idempotently, with fixed ids. A reader who starts the app must land on populated screens. An empty
queue cannot be evaluated. `requested_by` holds a user id, the same value `getCurrentUser()` returns.

🔴 **At least one pending refund must be requested by the APPROVER, and at least one other pending
refund by someone else.** Both are load-bearing and neither is decoration:

- The first is the **only** record that reaches the maker-checker rule. A requester is stopped by the
  role check before `assertDifferentActor` is ever called, so without this row the rule cannot be
  exercised through the UI at all, by a reviewer or on camera.
- The second is the **control**. It proves a refusal on the first came from maker-checker and not from
  an approve path that is broken for everyone.

Seeded records get their audit rows too, written through the same `appendAudit` the actions use. A
seeded record whose audit view shows only its approval reads as a request path that does not write
audit rows.

## What must stay true

`git clone`, `npm install`, `npm run dev` works on a machine that has nothing installed but Node. No
native compilation during install, no environment variables, no manual setup step. If a change puts
that at risk, choose the other option.
