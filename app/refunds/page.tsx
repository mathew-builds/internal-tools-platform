import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listRefunds } from "@/lib/refunds";
import { userName } from "@/lib/users";
import { requestRefundAction } from "./actions";
import { money, when } from "./_components/money";
import { Refusal, Success } from "./_components/refusal";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-zinc-200 text-zinc-700",
};

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
        <h1 className="text-xl font-semibold tracking-tight">Refunds</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Every refund stays visible and openable to any role that can open this queue,
          including ones you requested yourself. Maker-checker is enforced when an approval is
          submitted.
        </p>
      </div>

      {rule && message ? <Refusal rule={rule} message={message} /> : null}
      {ok ? <Success message={ok} /> : null}

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Refund</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Requested by</th>
              <th className="px-4 py-2 font-medium">Requested at</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((refund) => (
              <tr key={refund.id} className="border-t border-zinc-100">
                <td className="px-4 py-2 font-mono text-xs">
                  <Link
                    href={`/refunds/${refund.id}`}
                    className="text-blue-700 underline hover:text-blue-900"
                  >
                    {refund.id}
                  </Link>
                </td>
                <td className="px-4 py-2">{refund.customer}</td>
                <td className="px-4 py-2">{money(refund.amount_cents, refund.currency)}</td>
                <td className="px-4 py-2">
                  {userName(refund.requested_by)}
                  {refund.requested_by === user.id ? (
                    <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-900">
                      you
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-zinc-500">{when(refund.requested_at)}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[refund.status]}`}
                  >
                    {refund.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {can(user, "request", "refund") ? (
        <form
          action={requestRefundAction}
          className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold">Raise a refund request</h2>
          <div className="flex flex-wrap gap-3">
            <input
              name="customer"
              placeholder="Customer"
              required
              className="w-56 rounded-md border border-zinc-300 px-2 py-1 text-sm"
            />
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Amount (GBP)"
              required
              className="w-40 rounded-md border border-zinc-300 px-2 py-1 text-sm"
            />
            <input
              name="reason"
              placeholder="Reason"
              required
              className="min-w-64 flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white hover:bg-zinc-700"
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
