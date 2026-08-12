const HEADINGS: Record<string, string> = {
  "maker-checker": "Refused by the maker-checker rule",
  permission: "Refused by the permission check",
  state: "Refused by the record's state",
  "not-found": "Record not found",
  validation: "Refused by validation",
};

/**
 * Renders which rule refused, so a maker-checker refusal is visibly not a
 * permission error.
 */
export function Refusal({ rule, message }: { rule: string; message: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
    >
      <p className="font-semibold">{HEADINGS[rule] ?? `Refused by ${rule}`}</p>
      <p className="mt-1">{message}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-red-700">rule: {rule}</p>
    </div>
  );
}

export function Success({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
    >
      {message}
    </div>
  );
}
