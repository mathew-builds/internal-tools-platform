import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { RoleSwitcher } from "./_components/role-switcher";
import { getCurrentUser } from "@/lib/auth";
import { nav } from "@/lib/nav";
import { can } from "@/lib/rbac";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Internal tools platform",
  description:
    "Reviewable back-office queues sharing one governed foundation: auth, RBAC, an append-only audit log and maker-checker approval.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const entries = nav.filter((entry) =>
    can(user, entry.requires.action, entry.requires.resource),
  );

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 font-sans text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3">
            <div className="flex flex-wrap items-center gap-6">
              <Link
                href="/refunds"
                className="text-sm font-semibold tracking-tight text-zinc-900"
              >
                Internal tools
              </Link>
              <nav className="flex items-center gap-1">
                {entries.map((entry) => (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    title={entry.description}
                    className="rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    {entry.label}
                  </Link>
                ))}
              </nav>
            </div>
            <RoleSwitcher user={user} next="/refunds" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
