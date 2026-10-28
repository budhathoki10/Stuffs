import { requireUser } from "@/lib/auth/session";
import { ownedSite } from "@/lib/services/sites";
import { renderSiteHtml } from "@/lib/work/site";
import { htmlResponse, simplePage } from "@/lib/work/site-response";
import type { SiteTemplate } from "@/lib/work/types";

/** The freelancer's full-page preview, available before the site is published. */
export async function GET(_: Request, ctx: RouteContext<"/app/sites/[id]/preview">) {
  const user = await requireUser();
  const { id } = await ctx.params;
  const site = await ownedSite(user.id, id);
  if (!site) return htmlResponse(simplePage("Not found", "This site doesn't exist."), { status: 404 });
  const html = renderSiteHtml(site.content, {
    template: site.template as SiteTemplate,
    formAction: null,
    builtBy: { name: user.name, url: user.portfolioUrl },
  });
  return htmlResponse(html, { headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex" } });
}
