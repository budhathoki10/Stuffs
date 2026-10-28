import type { ReactNode } from "react";
import { SITE } from "@/lib/site";
import { SiteFooter, SiteHeader } from "./site-chrome";
import { Eyebrow } from "./ui";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-14">
        <Eyebrow>Last updated {SITE.legalUpdated}</Eyebrow>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight">{title}</h1>
        <div className="mt-10 space-y-4 text-[15px] leading-7 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-medium [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
