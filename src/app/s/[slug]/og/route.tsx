import { ImageResponse } from "next/og";
import { siteBySlug } from "@/lib/services/sites";
import { SITE_ACCENTS } from "@/lib/work/types";

/** The preview image WhatsApp and Facebook show when someone shares the site. */
export async function GET(_: Request, ctx: RouteContext<"/s/[slug]">) {
  const { slug } = await ctx.params;
  const row = await siteBySlug(slug);
  if (!row?.site.published) return new Response("Not found", { status: 404 });
  const c = row.site.content;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 72,
          background: SITE_ACCENTS[c.accent] ?? SITE_ACCENTS.charcoal,
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>{c.businessName.slice(0, 60)}</div>
        <div style={{ marginTop: 20, fontSize: 34, opacity: 0.85 }}>{c.tagline.slice(0, 90)}</div>
        {c.address && <div style={{ marginTop: 28, fontSize: 26, opacity: 0.7 }}>{c.address.slice(0, 80)}</div>}
      </div>
    ),
    { width: 1200, height: 630, headers: { "cache-control": "public, max-age=3600" } },
  );
}
