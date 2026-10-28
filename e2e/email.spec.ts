import { expect, test, type APIRequestContext } from "@playwright/test";
import { E2E_RESEND_WEBHOOK_SECRET } from "../playwright.config";
import { signWebhook } from "../src/lib/outreach/text";
import { latestEmailLink, query, setUpFreelancer } from "./helpers";

const email = `mailer-${Date.now()}@example.com`;

test.describe.configure({ mode: "serial" });

/** What Resend sends when an email arrives at reply+<token>@REPLY_DOMAIN. */
function resendWebhook(request: APIRequestContext, payload: object, secret = E2E_RESEND_WEBHOOK_SECRET) {
  const body = JSON.stringify(payload);
  const id = `msg_${Math.random().toString(36).slice(2)}`;
  const ts = Math.floor(Date.now() / 1000);
  return request.post("/api/webhooks/resend", {
    data: body,
    headers: { "content-type": "application/json", "svix-id": id, "svix-timestamp": String(ts), "svix-signature": signWebhook(secret, id, ts, body) },
  });
}

test("pitch, reply, quote and opt-out all happen inside the app", async ({ page }) => {
  await setUpFreelancer(page, email);
  await page.getByRole("link", { name: "Maple Street Dentist" }).click();
  await expect(page).toHaveURL(/\/app\/leads\/[0-9a-f-]{36}$/);
  const leadUrl = page.url();

  // Sending needs a confirmed address, to protect the shared sending domain.
  await page.getByRole("button", { name: "Draft the email" }).click();
  await page.getByRole("button", { name: "Send email" }).click();
  await expect(page.getByText("Confirm your email address first")).toBeVisible();
  await page.goto(latestEmailLink(email, "Confirm"));
  await page.goto(leadUrl);

  // The draft is kept.
  await expect(page.getByRole("button", { name: "Draft another version" })).toBeVisible();
  await expect(page.getByLabel("To")).toHaveValue("hello@maple.test");
  await page.getByRole("button", { name: "Send email" }).click();

  // The draft gives way to the conversation, starting with the email just sent.
  const thread = page.locator("#conversation");
  await expect(thread.getByRole("heading", { name: "Conversation" })).toBeVisible();
  await expect(thread.getByText("First email")).toBeVisible();
  await expect(thread.getByText(/reply "stop" or open/)).toBeVisible();
  await expect(page.getByText("Emailed", { exact: true }).first()).toBeVisible();

  const [{ token }] = await query((sql) => sql`select reply_token as token from leads where name = 'Maple Street Dentist' and reply_token is not null order by created_at desc limit 1`);

  // A forged webhook is refused; a signed one lands as a reply.
  const reply = {
    type: "email.received",
    data: {
      email_id: `rcv_${token}`,
      from: "Dr. Maple <hello@maple.test>",
      to: [`reply+${token}@reply.pitchcraft.test`],
      subject: "Re: Your website",
      text: "Yes, that's been bothering me. What would it cost?\n\nOn Tue, Test Freelancer wrote:\n> Hi Maple Street Dentist team,",
      message_id: "<abc@maple.test>",
    },
  };
  expect((await resendWebhook(page.request, reply, `whsec_${Buffer.from("wrong").toString("base64")}`)).status()).toBe(401);
  const delivered = await resendWebhook(page.request, reply);
  expect(await delivered.json()).toMatchObject({ result: "stored" });
  expect(await (await resendWebhook(page.request, reply)).json()).toMatchObject({ result: "duplicate" });

  // The inbox shows it, with an unread count in the menu.
  await page.goto("/app");
  await expect(page.getByLabel("1 unread")).toBeVisible();
  await page.getByRole("link", { name: /Inbox/ }).click();
  await expect(page.getByText("One business is waiting for your reply.")).toBeVisible();
  await page.getByRole("link", { name: /Maple Street Dentist/ }).click();
  await expect(thread.getByText("What would it cost?").first()).toBeVisible();
  await expect(thread.getByText("> Hi Maple Street Dentist team")).toBeHidden();
  await expect(page.getByText("Replied", { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("1 unread")).toHaveCount(0);

  await thread.getByLabel("Message").fill("About NPR 25,000 for the fixes. I'll send a proper quote now.");
  await thread.getByRole("button", { name: "Send reply" }).click();
  await expect(thread.getByRole("listitem").filter({ hasText: "About NPR 25,000 for the fixes." })).toBeVisible();
  await expect(thread.getByRole("heading", { name: "Follow up" })).toHaveCount(0);

  // The quote goes out from the app too, and counts as sent.
  await page.goto(`${leadUrl}/quote`);
  await page.getByRole("button", { name: "Build the quote" }).click();
  await page.getByRole("button", { name: "Email it to them" }).click();
  await expect(page.getByLabel("Message")).toHaveValue(/\/q\/[a-z0-9]{10}\n\nThanks,\nTest Freelancer$/);
  await page.getByRole("button", { name: "Send email" }).click();
  await expect(page.getByText("Sent to hello@maple.test.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Waiting for an answer")).toBeVisible();

  await page.goto(leadUrl);
  await expect(thread.getByText("Quote", { exact: true })).toBeVisible();

  // The business opts out from the link in the first email.
  await page.goto(`/x/${token}`);
  await expect(page.getByRole("heading", { name: "Stop emails to Maple Street Dentist?" })).toBeVisible();
  await page.getByRole("button", { name: "Stop emails" }).click();
  await expect(page.getByRole("heading", { name: "Done. No more emails." })).toBeVisible();
  await page.goto(leadUrl);
  await expect(page.getByText("Maple Street Dentist asked not to be emailed again.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Send/ })).toHaveCount(0);
});

test("bounces are recorded and the address is never emailed again", async ({ page }) => {
  const [{ id }] = await query((sql) => sql`select provider_id as id from messages where direction = 'out' limit 1`);
  const res = await resendWebhook(page.request, { type: "email.bounced", data: { email_id: id ?? "none", to: ["bounced@example.test"] } });
  expect(res.status()).toBe(200);
  const [row] = await query((sql) => sql`select reason from suppressions where email = 'bounced@example.test'`);
  expect(row.reason).toBe("bounce");
});

test("an unknown opt-out link explains what to do instead", async ({ page }) => {
  await page.goto("/x/doesnotexist1");
  await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
});
