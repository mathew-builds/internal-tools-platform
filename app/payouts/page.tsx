import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { isPayoutStatus, listPayouts, PAYOUT_STATUSES } from "@/lib/payouts";
import { userName } from "@/lib/users";
import { requestPayoutAction } from "./actions";
import { money, when } from "../refunds/_components/money";
import { Refusal, Success } from "../refunds/_components/refusal";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-zinc-200 text-zinc-700",
};

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ rule?: string; message?: string; ok?: string; status?: string }>;
}) {
  const user = await getCurrentUser();
  const { rule, message, ok, status } = await searchParams;
  const filter = isPayoutStatus(status) ? status : undefined;
  const payouts = listPayouts(filter);

  const filters: { label: string; href: string; active: boolean }[] = [
    { label: "all", href: "/payouts", active: !filter },
    ...PAYOUT_STATUSES.map((value) => ({
      label: value,
      href: `/payouts?status=${value}`,
      active: filter === value,
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Payout approvals</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Every payout stays visible and openable to any role that can open this queue, including
          ones you requested yourself. Maker-checker is enforced when an approval is submitted.
        </p>
      </div>

      {rule && message ? <Refusal rule={rule} message={message} /> : null}
      {ok ? <Success message={ok} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className={`rounded-md border px-3 py-1 text-sm ${
              entry.active
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
            }`}
          >
            {entry.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Payout</th>
              <th className="px-4 py-2 font-medium">Recipient</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Reference</th>
              <th className="px-4 py-2 font-medium">Requested by</th>
              <th className="px-4 py-2 font-medium">Requested at</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((payout) => (
              <tr key={payout.id} className="border-t border-zinc-100">
                <td className="px-4 py-2 font-mono text-xs">
                  <Link
                    href={`/payouts/${payout.id}`}
                    className="text-blue-700 underline hover:text-blue-900"
                  >
                    {payout.id}
                  </Link>
                </td>
                <td className="px-4 py-2">{payout.recipient}</td>
                <td className="px-4 py-2">{money(payout.amount_cents, payout.currency)}</td>
                <td className="px-4 py-2 text-zinc-600">{payout.reference}</td>
                <td className="px-4 py-2">
                  {userName(payout.requested_by)}
                  {payout.requested_by === user.id ? (
                    <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-900">
                      you
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-zinc-500">{when(payout.requested_at)}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[payout.status]}`}
                  >
                    {payout.status}
                  </span>
                </td>
              </tr>
            ))}
            {payouts.length === 0 ? (
              <tr className="border-t border-zinc-100">
                <td className="px-4 py-3 text-zinc-500" colSpan={7}>
                  No {filter ?? ""} payouts.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {can(user, "request", "payout") ? (
        <form
          action={requestPayoutAction}
          className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold">Raise a payout request</h2>
          <div className="flex flex-wrap gap-3">
            <input
              name="recipient"
              placeholder="Recipient"
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
              name="reference"
              placeholder="Reference"
              required
              className="min-w-64 flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Request payout
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
