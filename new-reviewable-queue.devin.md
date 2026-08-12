# New reviewable queue

Add a new maker-checker review queue to this internal tools platform, reusing the existing
foundation. The entity name and its fields are given in the session prompt.

## Before you write any code

1. Read `AGENTS.md` at the repository root and follow its stack and conventions.
2. Read the existing refunds queue. Treat it as the reference implementation for this platform.
3. Outline your implementation plan and share it with me for review before writing code.

## What the foundation already provides

Do not rebuild any of these. Import them.

- Session auth and the current-user helper
- Role-based access control
- Append-only audit log
- Maker-checker approval, where the user who requests a change cannot approve it

If you find yourself copying one of these modules instead of importing it, stop and import it.

## Features to build

1. List view for the new entity, filterable by status: pending, approved, rejected.
2. Detail view for a single record.
3. Request action. Creates a record in pending state and writes an audit entry.
4. Approve and reject actions. Restricted by role, blocked for the requesting user, each writes
   an audit entry.
5. A navigation entry wired into the existing layout.

If the session is time constrained, cut in this order: first the words "filterable by status" from
feature 1, then feature 2 entirely. Keep the list view itself. It is the queue screen, and feature 5
has nothing to link to without it.

## Technical notes

- No new external services and no new runtime dependencies. The app must still start from a cold
  clone using the commands documented in the README.
- Follow the existing data access pattern. Add a migration rather than hand-editing the schema.
- Keep the change scoped to this queue. Do not refactor the foundation while you are here.

## Testing

- Add a test asserting that a role without approval rights cannot approve a record.
- Add a test asserting that an approver cannot approve a record they themselves requested. This is a
  different assertion from the one above, and only this one exercises `assertDifferentActor`.
- Add a test asserting that an approver CAN approve a record someone else requested. Without it, the
  two above both pass on an approve path that refuses everyone.
- Run the test suite before opening a pull request.

## Deliverable

One pull request, scoped to this queue only. The PR description must state which foundation
modules were reused and which files are new.

## Out of scope, and this is a hard stop

This playbook covers queues whose records are structured fields plus a status transition.

It does **not** cover a queue that needs document upload, document storage, or a retention
policy. Those requirements sit outside the foundation's contract and are not made cheap by it.
If the requested queue needs any of them, say so and stop rather than building a partial version.
