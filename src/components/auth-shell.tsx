import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./ui";

/** Narrow single-column layout shared by sign-up, log-in and password pages. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-5 py-14">
      <Link href="/" aria-label="Pitchcraft home">
        <Logo />
      </Link>
      <h1 className="mt-12 font-serif text-3xl font-medium tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </main>
  );
}
