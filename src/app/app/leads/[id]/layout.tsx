import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadTabs } from "@/components/workspace/lead-tabs";
import { requireUser } from "@/lib/auth/session";
import { STATUS_LABELS, type LeadStatus } from "@/lib/leads/status";
import { ownedLead } from "@/lib/services/leads";

/** Shared header and tabs for everything a freelancer does with one business. */
export default async function LeadLayout({ children, params }: LayoutProps<"/app/leads/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const lead = await ownedLead(user.id, id);
  if (!lead) notFound();
  const won = lead.status === "won";
  return (
    <div className="space-y-8">
      <div>
        <Link href={won ? "/app/clients" : "/app"} className="text-[13px] text-muted hover:text-foreground">
          {won ? "Clients" : "Today's leads"}
        </Link>
        <span className="mx-2 text-faint">/</span>
        <span className="text-[13px] text-muted">{lead.category}</span>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-serif text-4xl font-medium tracking-tight">{lead.name}</h1>
          <span className={`text-sm ${won ? "font-medium text-money" : "text-muted"}`}>{STATUS_LABELS[lead.status as LeadStatus]}</span>
        </div>
        {lead.address && <p className="mt-1 text-sm text-muted">{lead.address}</p>}
      </div>
      <LeadTabs leadId={lead.id} />
      {children}
    </div>
  );
}
