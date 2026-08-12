import { setRole } from "@/app/actions";
import { ROLES, type User } from "@/lib/users";

export function RoleSwitcher({ user, next }: { user: User; next: string }) {
  return (
    <form action={setRole} className="flex items-center gap-2">
      <input type="hidden" name="next" value={next} />
      <label
        htmlFor="role"
        className="text-xs font-medium uppercase tracking-wide text-zinc-500"
      >
        Signed in as
      </label>
      <select
        id="role"
        name="role"
        defaultValue={user.role}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900"
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white hover:bg-zinc-700"
      >
        Switch
      </button>
      <span className="text-sm text-zinc-500">
        {user.name} ({user.id})
      </span>
    </form>
  );
}
