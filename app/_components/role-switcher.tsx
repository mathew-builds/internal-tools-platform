import { setRole } from "@/app/actions";
import { ROLES, type User } from "@/lib/users";

export function RoleSwitcher({ user, next }: { user: User; next: string }) {
  return (
    <form
      action={setRole}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 shadow-sm"
    >
      <input type="hidden" name="next" value={next} />
      <label htmlFor="role" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Signed in as
      </label>
      <select
        id="role"
        name="role"
        defaultValue={user.role}
        className="cursor-pointer rounded-md border border-zinc-400 bg-white px-2 py-1 text-sm font-medium text-zinc-900 shadow-sm hover:border-zinc-500 focus:outline-2 focus:outline-offset-2 focus:outline-blue-600"
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="cursor-pointer rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700 focus:outline-2 focus:outline-offset-2 focus:outline-blue-600"
      >
        Switch role
      </button>
      <span className="text-sm text-zinc-600">
        {user.name} <span className="font-mono text-xs text-zinc-500">({user.id})</span>
      </span>
    </form>
  );
}
