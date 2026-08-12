import type { Action, Resource } from "./rbac.ts";

export type NavEntry = {
  href: string;
  label: string;
  description: string;
  /** The grant a user needs for this entry to be shown. */
  requires: { action: Action; resource: Resource };
};

/**
 * The navigation, as data. The layout renders this array; adding a queue means
 * adding an entry here, not editing JSX.
 */
export const nav: NavEntry[] = [
  {
    href: "/refunds",
    label: "Refunds",
    description: "Customer refund requests awaiting a second pair of eyes",
    requires: { action: "read", resource: "refund" },
  },
];

export default nav;
