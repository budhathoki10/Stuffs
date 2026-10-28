"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "quote", label: "Quote" },
  { slug: "site", label: "Website" },
  { slug: "care", label: "Results & care" },
  { slug: "invoices", label: "Invoices" },
];

export function LeadTabs({ leadId }: { leadId: string }) {
  const pathname = usePathname();
  const base = `/app/leads/${leadId}`;
  return (
    <nav aria-label="Client workspace" className="-mx-5 overflow-x-auto border-b border-border px-5">
      <div className="flex gap-6 text-sm">
        {TABS.map((t) => {
          const href = t.slug ? `${base}/${t.slug}` : base;
          const active = pathname === href;
          return (
            <Link
              key={t.slug}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px shrink-0 border-b-2 py-2.5 ${active ? "border-ink text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
