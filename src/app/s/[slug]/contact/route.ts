import { receiveSiteMessage, siteBySlug } from "@/lib/services/sites";
import { clientIp, hashIp } from "@/lib/util";
import { htmlResponse, simplePage } from "@/lib/work/site-response";

/** Booking and contact form on a published site. Works without JavaScript. */
export async function POST(request: Request, ctx: RouteContext<"/s/[slug]">) {
  const { slug } = await ctx.params;
  const row = await siteBySlug(slug);
  if (!row?.site.published) return htmlResponse(simplePage("Page not found", "There's no website at this address."), { status: 404 });

  const back = `/s/${row.site.slug}#contact`;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return htmlResponse(simplePage("That didn't go through", "Please fill in the form again.", back), { status: 400 });
  }
  const field = (k: string) => String(form.get(k) ?? "");
  const result = await receiveSiteMessage(
    row,
    { name: field("name"), contact: field("contact"), message: field("message"), preferredDate: field("preferredDate"), honeypot: field("website") },
    hashIp(clientIp(request.headers)),
  );

  if (result === "invalid") {
    return htmlResponse(simplePage("A few details are missing", "Please add your name, a phone number or email, and a message.", back), { status: 400 });
  }
  if (result === "rate_limited") {
    return htmlResponse(
      simplePage("Thanks, we have your messages", `You've sent several already. ${row.site.content.businessName} will reply soon.`, back),
      { status: 429 },
    );
  }
  // Spam gets the same answer as a real request, so bots learn nothing.
  return new Response(null, { status: 303, headers: { location: `/s/${row.site.slug}?sent=1#contact` } });
}
