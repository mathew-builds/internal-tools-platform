import Link from "next/link";
import { notFound } from "next/navigation";
import { auditFor } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ENTITY, getPayout } from "@/lib/payouts";
import { userName } from "@/lib/users";
import { when } from "../../../refunds/_components/money";
import { Refusal } from "../../../refunds/_components/refusal";

export const dynamic = "force-dynamic";

export default async function PayoutAuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;

  const payout = getPayout(id);
  if (!payout) notFound();

  if (!can(user, "read", "audit")) {
    return (
      <div className="space-y-4">
        <Link
          href={`/payouts/${id}`}
          className="text-sm text-blue-700 underline hover:text-blue-900"
        >
          ← Back to payout
        </Link>
        <Refusal
          rule="permission"
          message={`Permission denied: role "${user.role}" may not read the audit log. Switch to the auditor role.`}
        />
      </div>
    );
  }

  const rows = auditFor(db, ENTITY, payout.id);

  return (
    <div className="space-y-6">
      <Link
        href={`/payouts/${payout.id}`}
        className="text-sm text-blue-700 underline hover:text-blue-900"
      >
        ← Back to payout
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Audit trail <span className="font-mono text-lg text-zinc-600">{payout.id}</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Append-only. UPDATE and DELETE on <span className="font-mono">audit_log</span> are refused
          by database triggers.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full table-auto text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-100 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Payload</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-zinc-100 align-top hover:bg-zinc-50">
                <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-zinc-500">
                  {when(row.created_at)}
                </td>
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  {userName(row.actor)}{" "}
                  <span className="font-mono text-xs font-normal text-zinc-500">({row.actor})</span>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs font-semibold text-zinc-800">
                    {row.action}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs break-all text-zinc-600">
                  {row.payload ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
