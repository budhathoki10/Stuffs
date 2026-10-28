"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/app", label: "Today" },
  { href: "/app/inbox", label: "Inbox" },
  { href: "/app/pipeline", label: "Pipeline" },
  { href: "/app/clients", label: "Clients" },
  { href: "/app/settings", label: "Settings" },
  { href: "/app/billing", label: "Billing" },
];

export function AppNav({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  return (
    <nav className="order-last -mb-px flex w-full gap-5 overflow-x-auto text-sm sm:order-none sm:mr-auto sm:w-auto">
      {NAV.map((n) => {
        const active = n.href === "/app" ? pathname === "/app" || pathname.startsWith("/app/leads") : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 border-b-2 py-3 ${active ? "border-ink text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {n.label}
            {n.href === "/app/inbox" && unread > 0 && (
              <span className="ml-1.5 rounded-full bg-pen px-1.5 py-px font-mono text-[11px] text-white" aria-label={`${unread} unread`}>
                {unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
