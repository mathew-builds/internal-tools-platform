import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listRefunds } from "@/lib/refunds";
import { userName } from "@/lib/users";
import { requestRefundAction } from "./actions";
import { money, when } from "./_components/money";
import { Refusal, StatusPill, Success } from "./_components/refusal";

export const dynamic = "force-dynamic";

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ rule?: string; message?: string; ok?: string }>;
}) {
  const user = await getCurrentUser();
  const { rule, message, ok } = await searchParams;
  const refunds = listRefunds();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Refunds</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Every refund stays visible and openable to any role that can open this queue,
          including ones you requested yourself. Maker-checker is enforced when an approval is
          submitted.
        </p>
      </div>

      {rule && message ? <Refusal rule={rule} message={message} /> : null}
      {ok ? <Success message={ok} /> : null}

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full table-auto text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-100 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="px-4 py-3">Refund</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Requested by</th>
              <th className="px-4 py-3">Requested at</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((refund) => (
              <tr key={refund.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link
                    href={`/refunds/${refund.id}`}
                    className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
                  >
                    {refund.id}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium">{refund.customer}</td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                  {money(refund.amount_cents, refund.currency)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {userName(refund.requested_by)}
                  {refund.requested_by === user.id ? (
                    <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-900">
                      you
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-500">
                  {when(refund.requested_at)}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={refund.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {can(user, "request", "refund") ? (
        <form
          action={requestRefundAction}
          className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Raise a refund request</h2>
          <div className="flex flex-wrap gap-3">
            <input
              name="customer"
              placeholder="Customer"
              required
              className="w-56 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm shadow-sm focus:outline-2 focus:outline-offset-2 focus:outline-blue-600"
            />
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Amount (GBP)"
              required
              className="w-40 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm tabular-nums shadow-sm focus:outline-2 focus:outline-offset-2 focus:outline-blue-600"
            />
            <input
              name="reason"
              placeholder="Reason"
              required
              className="min-w-64 flex-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm shadow-sm focus:outline-2 focus:outline-offset-2 focus:outline-blue-600"
            />
            <button
              type="submit"
              className="cursor-pointer rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700"
            >
              Request refund
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            An approver may raise a request too — that is why maker-checker exists.
          </p>
        </form>
      ) : (
        <p className="text-sm text-zinc-500">
          Role <span className="font-mono">{user.role}</span> has read-only access to this queue.
        </p>
      )}
    </div>
  );
}
