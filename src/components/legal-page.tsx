import type { ReactNode } from "react";
import { SITE } from "@/lib/site";
import { SiteFooter, SiteHeader } from "./site-chrome";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {SITE.legalUpdated}</p>
        <div className="mt-8 space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_a]:text-accent [&_a]:underline">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
