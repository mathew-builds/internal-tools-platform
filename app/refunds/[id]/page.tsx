import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getRefund } from "@/lib/refunds";
import { userName } from "@/lib/users";
import { approveRefundAction, rejectRefundAction } from "../actions";
import { money, when } from "../_components/money";
import { Refusal, Success } from "../_components/refusal";

export const dynamic = "force-dynamic";

export default async function RefundPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rule?: string; message?: string; ok?: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;
  const { rule, message, ok } = await searchParams;

  const refund = getRefund(id);
  if (!refund) notFound();

  // Rendered for anyone who may approve, on every pending record — including one
  // this user requested. The rule refuses at submission, not in the render path.
  const showDecisionControls = refund.status === "pending" && can(user, "approve", "refund");

  return (
    <div className="space-y-6">
      <Link href="/refunds" className="text-sm text-blue-700 underline hover:text-blue-900">
        ← Back to refunds
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Refund <span className="font-mono text-base">{refund.id}</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-600">{refund.reason}</p>
      </div>

      {rule && message ? <Refusal rule={rule} message={message} /> : null}
      {ok ? <Success message={ok} /> : null}

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Customer</dt>
          <dd className="mt-1">{refund.customer}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Amount</dt>
          <dd className="mt-1">{money(refund.amount_cents, refund.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Status</dt>
          <dd className="mt-1">{refund.status}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Requested by</dt>
          <dd className="mt-1">
            {userName(refund.requested_by)}{" "}
            <span className="font-mono text-xs text-zinc-500">({refund.requested_by})</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Requested at</dt>
          <dd className="mt-1 text-zinc-600">{when(refund.requested_at)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Decided by</dt>
          <dd className="mt-1">
            {refund.decided_by ? userName(refund.decided_by) : "—"}
            {refund.decided_at ? (
              <span className="ml-2 text-xs text-zinc-500">{when(refund.decided_at)}</span>
            ) : null}
          </dd>
        </div>
        {refund.decision_note ? (
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Decision note</dt>
            <dd className="mt-1">{refund.decision_note}</dd>
          </div>
        ) : null}
      </dl>

      {showDecisionControls ? (
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Decide this refund</h2>
          <form action={approveRefundAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={refund.id} />
            <input
              name="note"
              placeholder="Note (optional)"
              className="min-w-64 flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-emerald-700 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Approve
            </button>
          </form>
          <form action={rejectRefundAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={refund.id} />
            <input
              name="note"
              placeholder="Note (optional)"
              className="min-w-64 flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Reject
            </button>
          </form>
          {refund.requested_by === user.id ? (
            <p className="text-xs text-zinc-500">
              You requested this refund. The control stays enabled on purpose: press Approve and
              the maker-checker rule refuses it.
            </p>
          ) : null}
        </div>
      ) : refund.status === "pending" ? (
        <p className="text-sm text-zinc-500">
          Role <span className="font-mono">{user.role}</span> cannot decide refunds.
        </p>
      ) : null}

      <Link
        href={`/refunds/${refund.id}/audit`}
        className="inline-block text-sm text-blue-700 underline hover:text-blue-900"
      >
        View audit trail for this refund →
      </Link>
    </div>
  );
}
