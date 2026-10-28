import { verifyWebhook } from "@/lib/outreach/text";
import { fetchReceivedEmail, handleDeliveryProblem, receiveReply } from "@/lib/services/outreach";

type ResendEvent = {
  type: string;
  data: {
    email_id?: string;
    from?: string;
    to?: string[] | string;
    subject?: string;
    text?: string | null;
    message_id?: string;
    headers?: Record<string, string>;
  };
};

const list = (v: string[] | string | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

function header(headers: Record<string, string> | undefined, name: string) {
  if (!headers) return null;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? headers[key] : null;
}

/** Turn the little HTML some mail apps send without a text part into readable text. */
function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Resend webhooks: `email.received` (replies to reply+<token>@REPLY_DOMAIN), and
 * `email.bounced` / `email.complained` (those addresses are never emailed again).
 * A non-2xx answer makes Resend retry, so only real failures return one.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const ok = verifyWebhook(
    process.env.RESEND_WEBHOOK_SECRET,
    { id: request.headers.get("svix-id"), timestamp: request.headers.get("svix-timestamp"), signature: request.headers.get("svix-signature") },
    raw,
  );
  if (!ok) return new Response("Invalid signature", { status: 401 });

  let event: ResendEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const data = event.data ?? {};

  if (event.type === "email.bounced" || event.type === "email.complained") {
    await handleDeliveryProblem(data.email_id ?? null, list(data.to), event.type === "email.bounced" ? "bounce" : "complaint");
    return Response.json({ ok: true });
  }

  if (event.type === "email.received" && data.email_id) {
    // The event carries metadata only; the body comes from the Receiving API.
    const full = data.text ? data : await fetchReceivedEmail(data.email_id);
    const text = full.text || ("html" in full && full.html ? htmlToText(full.html) : "");
    const result = await receiveReply({
      providerId: data.email_id,
      from: full.from ?? data.from ?? "",
      to: list(full.to ?? data.to),
      subject: full.subject ?? data.subject ?? "",
      text,
      messageIdHeader: full.message_id ?? header(full.headers, "message-id"),
    });
    return Response.json({ ok: true, result });
  }

  return Response.json({ ok: true, ignored: event.type });
}
