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
        <h1 className="text-xl font-semibold tracking-tight">
          Audit trail — <span className="font-mono text-base">{payout.id}</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Append-only. UPDATE and DELETE on <span className="font-mono">audit_log</span> are refused
          by database triggers.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Actor</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Payload</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-zinc-100 align-top">
                <td className="px-4 py-2 whitespace-nowrap text-zinc-500">
                  {when(row.created_at)}
                </td>
                <td className="px-4 py-2">
                  {userName(row.actor)}{" "}
                  <span className="font-mono text-xs text-zinc-500">({row.actor})</span>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{row.action}</td>
                <td className="px-4 py-2 font-mono text-xs break-all text-zinc-600">
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
