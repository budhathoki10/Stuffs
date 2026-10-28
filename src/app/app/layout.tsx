import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { VerifyEmailBanner } from "@/components/auth-forms";
import { Badge, Logo } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { isPro } from "@/lib/plans";

const NAV = [
  { href: "/app", label: "Today" },
  { href: "/app/pipeline", label: "Pipeline" },
  { href: "/app/settings", label: "Settings" },
  { href: "/app/billing", label: "Billing" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/app" aria-label="Dashboard">
            <Logo />
          </Link>
          {/* Full-width second row on phones, inline next to the logo on larger screens. */}
          <nav className="order-last -mx-2 flex w-full gap-1 overflow-x-auto text-sm sm:order-none sm:mx-0 sm:mr-auto sm:w-auto">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="shrink-0 rounded-md px-2.5 py-1.5 text-muted hover:bg-background hover:text-foreground">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            {isPro(user) ? <Badge tone="good">Pro</Badge> : <Link href="/app/billing"><Badge tone="warn">Free · Upgrade</Badge></Link>}
            <span className="hidden text-muted sm:inline">{user.email}</span>
            <form action={logout}>
              <button type="submit" className="text-muted hover:text-foreground">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      {!user.emailVerifiedAt && <VerifyEmailBanner email={user.email} />}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
