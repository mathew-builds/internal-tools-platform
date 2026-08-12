# Internal tools platform

A small internal-tools app: reviewable back-office queues sharing one governed foundation.
Authentication, role-based access control, an append-only audit log and maker-checker approval are
written once in `lib/`, and every queue consumes them. Adding a queue never means reimplementing any of
them.

Two queues are built. **Refunds:** customer refund requests, showing who requested each one, with
approve and reject decided by a second person. **Payout approvals:** outgoing supplier payouts
(recipient, amount, reference), filterable by status, on the same request-then-decide path.

## Requirements

Node 22. Built and run on v22.21.1.

## How to run it

```bash
git clone https://github.com/mathew-builds/internal-tools-platform.git
cd internal-tools-platform
npm install
npm run dev
```

The database is created, migrated and seeded on first boot. There is no migrate step and no environment
file.

## Demo path

The maker-checker rule is the point of this codebase, and it is invisible unless you go looking. Five
steps, using the role switcher:

1. Switch to the `approver` role. The queue shows who requested each refund.
2. Open a pending refund that the approver requested, and approve it. It is refused.
3. Open a pending refund that someone else requested, and approve it. It succeeds.

   Steps 2 and 3 are the same user, in the same role, pressing the same button. That is what makes step
   2 the maker-checker rule rather than a permission error or an approve path that is broken for
   everyone. Run them in that order, and do not accept the refusal in step 2 on its own.

4. Switch to the `requester` role and raise a request, to see the other half of the loop.
5. Switch to the `auditor` role, open the refund you approved in step 3 and open its audit view. The
   request and the approval are both there, with the actor on each row.

## What the append-only audit log is enforced by, and what it is not

The audit table has BEFORE UPDATE and BEFORE DELETE triggers that RAISE(ABORT), so any UPDATE or DELETE
that goes through the application fails with a constraint error instead of silently succeeding. That is
the engine refusing it, not my code paths remembering not to.

I did not build a hash chain inside the two hours. It belongs on the audit row, chaining each entry to
the previous one so that tampering is detectable even where the engine permits it, and it is the first
thing I would add next.

What this is not is access control. SQLite has no GRANT or REVOKE, and any process that can write the
file can drop the trigger. So in SQLite this is protection against my own bugs, not against a privileged
actor. On Postgres I would own the table as a different role and grant the app INSERT and SELECT only,
and that is the upgrade path.

This logs writes. It does not log reads, and who viewed this refund is the question your regulator will
actually ask. That is a second table, a middleware hook on every read path and a retention decision, and
it is one of the reasons I am not telling you to rebuild KYC.

## What is deliberately not built

- **The KYC review queue.** The hard part there is document storage and a retention schedule, not the UI,
  and this foundation makes neither of them cheap. A queue needing document upload or retention does not
  fit the pattern, and the foundation says so rather than shipping a partial version.
- **The feature-flag admin panel.** The recommendation is to retire it to a dedicated flag service, not
  to rebuild it here.

## How to add a new tool

A queue is a set of records moving from pending to approved or rejected, where the person who requested
the change cannot be the person who approves it.

`new-reviewable-queue.devin.md` at the repository root is the Playbook that generates one. Attach it to a
session and give it the entity name and its fields. It imports `getCurrentUser`, `can`, `appendAudit` and
`assertDifferentActor` rather than reimplementing them, so a new queue is a migration, a route folder,
and one entry in `lib/nav.ts`.

The boundary is explicit: a queue whose records need document upload, document storage or a retention
policy does not fit this pattern and does not get cheap.
