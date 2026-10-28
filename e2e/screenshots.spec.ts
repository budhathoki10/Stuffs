import { expect, test } from "@playwright/test";
import { setUpFreelancer } from "./helpers";

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
