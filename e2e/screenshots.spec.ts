import { expect, test } from "@playwright/test";
import { E2E_RESEND_WEBHOOK_SECRET } from "../playwright.config";
import { signWebhook } from "../src/lib/outreach/text";
import { latestEmailLink, query, setUpFreelancer } from "./helpers";

// Regenerates the images in docs/screenshots. Run with SCREENSHOTS=1 npx playwright test screenshots.
test.skip(!process.env.SCREENSHOTS, "Set SCREENSHOTS=1 to regenerate docs/screenshots");
test.use({ viewport: { width: 1280, height: 860 } });

const shot = (name: string) => ({ path: `docs/screenshots/${name}.png`, fullPage: true });

test("client workspace screenshots", async ({ page, browser }) => {
  await setUpFreelancer(page, `shots-${Date.now()}@example.com`);
  await page.getByRole("link", { name: "Sunrise Dentist" }).click();
  await expect(page).toHaveURL(/\/app\/leads\/[0-9a-f-]{36}$/);
  const lead = page.url();

  await page.goto("/app/settings#payment");
  await page.getByLabel("eSewa ID").fill("9841000001");
  await page.getByLabel("Bank", { exact: true }).fill("Nabil Bank");
  await page.getByLabel("Account name").fill("Test Freelancer");
  await page.getByLabel("Account number").fill("01234567890123");
  await page.getByRole("button", { name: "Save payment details" }).click();
  await expect(page.getByText("Payment details saved.")).toBeVisible();

  await page.goto(`${lead}/quote`);
  await page.getByLabel("Currency").selectOption("NPR");
  await page.getByRole("button", { name: "Build the quote" }).click();
  await page.getByLabel("Note to the client").fill("I can start next week and have it live in 10 days. Half up front, half when it's live.");
  await page.getByRole("button", { name: "Save quote" }).click();
  await page.getByRole("button", { name: "I've sent it" }).click();
  await expect(page.getByText("Waiting for an answer")).toBeVisible();
  await page.screenshot(shot("desktop-quote"));
  const quoteUrl = await page.getByLabel("Link for the client").inputValue();

  const client = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await client.goto(quoteUrl);
  await client.screenshot(shot("desktop-client-quote"));
  await client.getByLabel("Your name").fill("Dr. Sita Sharma");
  await client.getByRole("button", { name: /Accept for/ }).click();
  await expect(client.getByText(/Accepted by/)).toBeVisible();

  await page.goto(`${lead}/site`);
  await page.getByRole("button", { name: "Start the website" }).click();
  await page.getByLabel("WhatsApp").fill("+977 9841234567");
  await page.getByLabel("Opening hours").fill("Sun to Fri, 9am to 6pm\nSaturday closed");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  await page.screenshot(shot("desktop-site-builder"));
  const siteUrl = await page.getByLabel("Link for the client").inputValue();

  await client.goto(siteUrl);
  await client.screenshot(shot("desktop-client-site"));
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(siteUrl);
  await phone.screenshot({ path: "docs/screenshots/mobile-client-site.png" });

  await page.goto(`${lead}/care`);
  await page.getByLabel("Address of the finished site").fill(siteUrl);
  await page.getByRole("button", { name: "Check it now" }).click();
  await expect(page.getByText("The before-and-after report is ready")).toBeVisible();
  await page.getByLabel("Site to watch").fill(siteUrl);
  await page.getByRole("button", { name: "Start monitoring" }).click();
  await expect(page.getByRole("button", { name: "Check now" })).toBeVisible();
  await page.screenshot(shot("desktop-care"));
  await client.goto(await page.getByLabel("Link for the client").first().inputValue());
  await client.screenshot(shot("desktop-client-before-after"));

  await page.goto(`${lead}/invoices`);
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page.getByText("Invoice created.")).toBeVisible();
  await page.screenshot(shot("desktop-invoices"));
  await client.goto(await page.getByRole("link", { name: "INV-0001" }).getAttribute("href").then((h) => h!));
  await client.screenshot(shot("desktop-client-invoice"));

  await page.goto("/app/clients");
  await page.screenshot(shot("desktop-clients"));
});

test("conversation and inbox screenshots", async ({ page }) => {
  const address = `shots-mail-${Date.now()}@example.com`;
  await setUpFreelancer(page, address);
  await page.goto(latestEmailLink(address, "Confirm"));
  await page.goto("/app");
  await page.getByRole("link", { name: "Maple Street Dentist" }).click();
  await page.getByRole("button", { name: "Draft the email" }).click();
  await page.getByRole("button", { name: "Send email" }).click();
  await expect(page.getByRole("heading", { name: "Conversation" })).toBeVisible();
  const lead = page.url();

  const [{ token }] = await query((sql) => sql`select reply_token as token from leads where reply_token is not null order by updated_at desc limit 1`);
  const body = JSON.stringify({
    type: "email.received",
    data: {
      email_id: `shot_${token}`,
      from: "Dr. Anita Rai <hello@maple.test>",
      to: [`reply+${token}@reply.pitchcraft.test`],
      subject: "Re: Your website",
      text: "Thanks for pointing that out, I didn't know the site looked like that on phones.\n\nWhat would it cost to fix, and how long would it take?\n\nAnita",
    },
  });
  const ts = Math.floor(Date.now() / 1000);
  await page.request.post("/api/webhooks/resend", {
    data: body,
    headers: { "content-type": "application/json", "svix-id": "shot", "svix-timestamp": String(ts), "svix-signature": signWebhook(E2E_RESEND_WEBHOOK_SECRET, "shot", ts, body) },
  });

  await page.goto("/app/inbox");
  await page.screenshot(shot("desktop-inbox"));
  await page.goto(lead);
  await page.locator("#conversation").getByLabel("Message").fill("Hi Anita,\n\nAbout NPR 25,000, and I can have it done in a week. I'll send a proper quote today.\n\nKushal");
  await page.screenshot(shot("desktop-conversation"));
});
