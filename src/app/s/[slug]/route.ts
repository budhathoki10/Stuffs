import { siteBySlug, siteUrl } from "@/lib/services/sites";
import { renderSiteHtml } from "@/lib/work/site";
import { htmlResponse, simplePage } from "@/lib/work/site-response";
import type { SiteTemplate } from "@/lib/work/types";

/** A published client website. Plain HTML, so it loads fast on any phone. */
export async function GET(request: Request, ctx: RouteContext<"/s/[slug]">) {
  const { slug } = await ctx.params;
  const row = await siteBySlug(slug);
  if (!row?.site.published) {
    return htmlResponse(simplePage("Page not found", "There's no website at this address."), { status: 404 });
  }
  const url = siteUrl(row.site.slug);
  const html = renderSiteHtml(row.site.content, {
    template: row.site.template as SiteTemplate,
    canonicalUrl: url,
    ogImageUrl: `${url}/og`,
    formAction: `/s/${row.site.slug}/contact`,
    sent: new URL(request.url).searchParams.get("sent") === "1",
    builtBy: { name: row.freelancer.name, url: row.freelancer.portfolioUrl },
  });
  return htmlResponse(html, { headers: { "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } });
}
