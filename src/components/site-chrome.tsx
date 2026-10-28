import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { leadSourceName } from "@/lib/leads";
import { ButtonLink, Logo } from "./ui";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <Link href="/" aria-label="Pitchcraft home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/#how" className="hidden text-muted hover:text-foreground sm:inline">
            How it works
          </Link>
          <Link href="/#pricing" className="hidden text-muted hover:text-foreground sm:inline">
            Pricing
          </Link>
          {user ? (
            <ButtonLink href="/app">Go to your leads</ButtonLink>
          ) : (
            <>
              <Link href="/login" className="text-muted hover:text-foreground">
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
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} Pitchcraft</span>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-1">
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/refund" className="hover:text-foreground">
            Refunds
          </Link>
          {leadSourceName() === "osm" && <span>Map data © OpenStreetMap contributors</span>}
        </nav>
      </div>
    </footer>
  );
}
