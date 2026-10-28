import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { ButtonLink, Logo } from "./ui";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" aria-label="Pitchcraft home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-3">
          <Link href="/#pricing" className="hidden px-2 text-muted hover:text-foreground sm:inline">
            Pricing
          </Link>
          {user ? (
            <ButtonLink href="/app">Open dashboard</ButtonLink>
          ) : (
            <>
              <Link href="/login" className="px-2 text-muted hover:text-foreground">
                Log in
              </Link>
              <ButtonLink href="/signup">Start free</ButtonLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} Pitchcraft. Find clients without paying platform fees.</span>
        <span>Business data © OpenStreetMap contributors</span>
      </div>
    </footer>
  );
}
