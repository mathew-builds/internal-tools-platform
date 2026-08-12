type Style = { heading: string; box: string; bar: string; chip: string; label: string };

/**
 * One style per rule, so the three states a demo runs through — a maker-checker
 * refusal, a permission refusal and a success — cannot be mistaken for one
 * another at a glance. Maker-checker is the loudest: it is the control this
 * codebase exists to demonstrate.
 */
const RULES: Record<string, Style> = {
  "maker-checker": {
    heading: "Refused by the maker-checker rule",
    box: "border-red-400 bg-red-50 text-red-950",
    bar: "bg-red-600",
    chip: "bg-red-600 text-white",
    label: "Refused",
  },
  permission: {
    heading: "Refused by the permission check",
    box: "border-amber-400 bg-amber-50 text-amber-950",
    bar: "bg-amber-500",
    chip: "bg-amber-500 text-amber-950",
    label: "Not permitted",
  },
  state: {
    heading: "Refused by the record's state",
    box: "border-zinc-300 bg-white text-zinc-800",
    bar: "bg-zinc-400",
    chip: "bg-zinc-200 text-zinc-800",
    label: "Refused",
  },
  "not-found": {
    heading: "Record not found",
    box: "border-zinc-300 bg-white text-zinc-800",
    bar: "bg-zinc-400",
    chip: "bg-zinc-200 text-zinc-800",
    label: "Not found",
  },
  validation: {
    heading: "Refused by validation",
    box: "border-zinc-300 bg-white text-zinc-800",
    bar: "bg-zinc-400",
    chip: "bg-zinc-200 text-zinc-800",
    label: "Invalid",
  },
};

/**
 * Renders which rule refused, so a maker-checker refusal is visibly not a
 * permission error.
 */
export function Refusal({ rule, message }: { rule: string; message: string }) {
  const style = RULES[rule] ?? {
    heading: `Refused by ${rule}`,
    box: "border-zinc-300 bg-white text-zinc-800",
    bar: "bg-zinc-400",
    chip: "bg-zinc-200 text-zinc-800",
    label: "Refused",
  };

  return (
    <div
      role="alert"
      className={`flex overflow-hidden rounded-lg border shadow-sm ${style.box}`}
    >
      <div className={`w-2 shrink-0 ${style.bar}`} aria-hidden />
      <div className="flex-1 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${style.chip}`}
          >
            {style.label}
          </span>
          <p className="text-base font-semibold">{style.heading}</p>
        </div>
        <p className="mt-1.5 text-sm">{message}</p>
        <p className="mt-1.5 font-mono text-xs uppercase tracking-wide opacity-70">rule: {rule}</p>
      </div>
    </div>
  );
}

export function Success({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex overflow-hidden rounded-lg border border-emerald-400 bg-emerald-50 text-emerald-950 shadow-sm"
    >
      <div className="w-2 shrink-0 bg-emerald-600" aria-hidden />
      <div className="flex flex-1 flex-wrap items-center gap-2 px-4 py-3">
        <span className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
          Done
        </span>
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}

/**
 * The status pill used in the queue lists and on the detail pages: colour plus a
 * dot, so pending, approved and rejected are distinguishable at a glance and not
 * three grey words.
 */
const STATUSES: Record<string, { pill: string; dot: string }> = {
  pending: { pill: "border-amber-300 bg-amber-100 text-amber-900", dot: "bg-amber-500" },
  approved: { pill: "border-emerald-300 bg-emerald-100 text-emerald-900", dot: "bg-emerald-600" },
  rejected: { pill: "border-rose-300 bg-rose-100 text-rose-900", dot: "bg-rose-600" },
};

export function StatusPill({ status }: { status: string }) {
  const style = STATUSES[status] ?? {
    pill: "border-zinc-300 bg-zinc-100 text-zinc-800",
    dot: "bg-zinc-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.pill}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden />
      {status}
    </span>
  );
}
