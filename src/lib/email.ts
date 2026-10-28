import "server-only";
import { appendFile } from "node:fs/promises";

export type Email = { to: string; subject: string; text: string; html: string };

/**
 * Send a transactional email through Resend (https://resend.com/docs/api-reference/emails/send-email).
 * Without RESEND_API_KEY, emails are appended to EMAIL_DEV_OUTBOX (JSON lines) for local
 * development and tests, so reset links can still be followed.
 */
export async function sendEmail(email: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Pitchcraft <onboarding@resend.dev>", ...email }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Resend failed (${res.status}): ${await res.text().catch(() => "")}`);
    return;
  }
  const outbox = process.env.EMAIL_DEV_OUTBOX;
  if (outbox) {
    await appendFile(outbox, `${JSON.stringify({ ...email, sentAt: new Date().toISOString() })}\n`);
    return;
  }
  if (process.env.NODE_ENV === "production") {
    console.warn(`Email not sent (RESEND_API_KEY is not set): "${email.subject}"`);
  } else {
    console.info(`[dev email] To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}`);
  }
}

function layout(heading: string, intro: string, buttonLabel: string, link: string, outro: string) {
  const text = `${heading}\n\n${intro}\n\n${buttonLabel}: ${link}\n\n${outro}\n\nPitchcraft`;
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1c1f1d;max-width:520px;margin:0 auto;padding:24px">
<h1 style="font-size:20px">${heading}</h1>
<p>${intro}</p>
<p><a href="${link}" style="display:inline-block;background:#157a4a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${buttonLabel}</a></p>
<p style="font-size:13px;color:#5f6660">Or paste this link into your browser:<br>${link}</p>
<p style="font-size:13px;color:#5f6660">${outro}</p>
</body></html>`;
  return { text, html };
}

export function verifyEmailMessage(to: string, name: string, link: string): Email {
  return {
    to,
    subject: "Confirm your Pitchcraft email",
    ...layout(
      `Hi ${name}, one quick thing`,
      "Confirm this is your email address so we can send you receipts and password resets.",
      "Confirm my email",
      link,
      "This link expires in 3 days. If you didn't create a Pitchcraft account, you can ignore this email.",
    ),
  };
}

export function resetPasswordMessage(to: string, link: string): Email {
  return {
    to,
    subject: "Reset your Pitchcraft password",
    ...layout(
      "Reset your password",
      "Someone (hopefully you) asked to reset the password for your Pitchcraft account.",
      "Choose a new password",
      link,
      "This link expires in 1 hour and works once. If you didn't ask for this, ignore this email and your password stays the same.",
    ),
  };
}

/** Plain notification: a heading, a few short paragraphs, and an optional link. */
export function noticeMessage(
  to: string,
  subject: string,
  heading: string,
  paragraphs: string[],
  link?: { label: string; url: string },
): Email {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const text = [heading, ...paragraphs, link ? `${link.label}: ${link.url}` : null, "Pitchcraft"].filter(Boolean).join("\n\n");
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1c1f1d;max-width:520px;margin:0 auto;padding:24px">
<h1 style="font-size:20px">${esc(heading)}</h1>
${paragraphs.map((p) => `<p style="white-space:pre-line">${esc(p)}</p>`).join("\n")}
${link ? `<p><a href="${esc(link.url)}" style="display:inline-block;background:#1b1a17;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${esc(link.label)}</a></p>` : ""}
</body></html>`;
  return { to, subject, text, html };
}
