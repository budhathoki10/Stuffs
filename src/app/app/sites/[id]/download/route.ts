import { requireUser } from "@/lib/auth/session";
import { ownedSite } from "@/lib/services/sites";
import { renderSiteHtml } from "@/lib/work/site";
import { simplePage } from "@/lib/work/site-response";
import type { SiteTemplate } from "@/lib/work/types";

/**
 * The site as one HTML file the client can host anywhere (cPanel, Netlify, GitHub Pages).
 * Without Pitchcraft behind it the form can't post, so it shows call, WhatsApp and email buttons.
 */
export async function GET(_: Request, ctx: RouteContext<"/app/sites/[id]/download">) {
  const user = await requireUser();
  const { id } = await ctx.params;
  const site = await ownedSite(user.id, id);
  if (!site) return new Response(simplePage("Not found", "This site doesn't exist."), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  const html = renderSiteHtml(site.content, {
    template: site.template as SiteTemplate,
    formAction: null,
    builtBy: { name: user.name, url: user.portfolioUrl },
  });
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="${site.slug}.html"`,
      "cache-control": "private, no-store",
    },
  });
}
