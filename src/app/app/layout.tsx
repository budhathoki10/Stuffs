import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { VerifyEmailBanner } from "@/components/auth-forms";
import { Logo } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { isPro } from "@/lib/plans";
import { unreadCount } from "@/lib/services/outreach";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = await unreadCount(user.id);
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-10 px-5">
          <Link href="/app" aria-label="Your leads" className="py-3">
            <Logo />
          </Link>
          <AppNav unread={unread} />
          <div className="ml-auto flex items-center gap-4 py-3 text-[13px] sm:ml-0">
            {isPro(user) ? (
              <span className="font-medium">Pro</span>
            ) : (
              <Link href="/app/billing" className="text-muted hover:text-foreground">
                Free plan · <span className="text-foreground underline underline-offset-4">Upgrade</span>
              </Link>
            )}
            <span className="hidden text-muted md:inline">{user.email}</span>
            <form action={logout}>
              <button type="submit" className="text-muted hover:text-foreground">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      {!user.emailVerifiedAt && <VerifyEmailBanner email={user.email} />}
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">{children}</main>
    </>
  );
}
