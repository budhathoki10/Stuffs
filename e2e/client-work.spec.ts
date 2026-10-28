import { expect, test } from "@playwright/test";
import { setUpFreelancer } from "./helpers";

const email = `builder-${Date.now()}@example.com`;

test.describe.configure({ mode: "serial" });

/**
 * The whole job after the pitch: quote, the client accepts, build and publish their
 * site, a visitor books, prove the result, monitor it, invoice and get paid.
 */
test("a freelancer quotes, builds the site, proves the result and gets paid, all in the app", async ({ page, browser }) => {
  await setUpFreelancer(page, email);
  await page.getByRole("link", { name: "Sunrise Dentist" }).click();
  await expect(page).toHaveURL(/\/app\/leads\/[0-9a-f-]{36}$/);
  const leadUrl = page.url();
  await expect(page.getByRole("navigation", { name: "Client workspace" })).toBeVisible();

  // Quote, built from the audit: no website means a new site plus hosting.
  await page.getByRole("link", { name: "Quote", exact: true }).click();
  await page.getByLabel("Currency").selectOption("NPR");
  await page.getByRole("button", { name: "Build the quote" }).click();
  await expect(page.getByLabel("Line 1 description")).toHaveValue("New website");
  await expect(page.getByTestId("items-total")).toHaveText("NPR 39,000");
  await page.getByLabel("Line 1 price in NPR").fill("30,000");
  await expect(page.getByTestId("items-total")).toHaveText("NPR 34,000");
  await page.getByRole("button", { name: "Save quote" }).click();
  await expect(page.getByText("Quote saved.")).toBeVisible();
  await page.getByRole("button", { name: "I've sent it" }).click();
  await expect(page.getByText("Waiting for an answer")).toBeVisible();
  const quoteUrl = await page.getByLabel("Link for the client").inputValue();
  expect(quoteUrl).toMatch(/\/q\/[a-z0-9]{10}$/);

  // The client, not logged in, accepts.
  const client = await browser.newPage();
  await client.goto(quoteUrl);
  await expect(client.getByRole("heading", { name: "Sunrise Dentist" })).toBeVisible();
  await expect(client.getByTestId("document-total")).toHaveText("NPR 34,000");
  await client.getByLabel("Your name").fill("Dr. Sita Sharma");
  await client.getByRole("button", { name: "Accept for NPR 34,000" }).click();
  await expect(client.getByText(/Accepted by Dr\. Sita Sharma/)).toBeVisible();

  await page.reload();
  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
  await expect(page.getByText("Won", { exact: true })).toBeVisible();
  await page.goto("/app");
  await expect(page.getByTestId("stat-earned")).toHaveText("NPR 34,000");

  // Website: start, edit, preview, publish.
  await page.goto(`${leadUrl}/site`);
  await page.getByRole("button", { name: "Start the website" }).click();
  await expect(page.getByLabel("Business name")).toHaveValue("Sunrise Dentist");
  await page.getByLabel("Headline").fill("Gentle dental care in Kathmandu");
  await page.getByLabel("WhatsApp").fill("+977 9841234567");
  await expect(page.frameLocator('iframe[title="Website preview"]').getByText("Gentle dental care in Kathmandu").first()).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  const siteUrl = await page.getByLabel("Link for the client").inputValue();
  expect(siteUrl).toMatch(/\/s\/sunrise-dentist$/);

  const download = await page.request.get(await page.getByRole("link", { name: "Download HTML" }).getAttribute("href").then((h) => h!));
  expect(download.headers()["content-disposition"]).toContain('filename="sunrise-dentist.html"');
  expect(await download.text()).toContain("Gentle dental care in Kathmandu");

  // A visitor books through the live site, with no JavaScript involved.
  const visitor = await browser.newPage({ javaScriptEnabled: false });
  const live = await visitor.goto(siteUrl);
  expect(live?.headers()["content-security-policy"]).toContain("default-src 'none'");
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Sunrise Dentist");
  await visitor.getByLabel("Your name").fill("Hari");
  await visitor.getByLabel("Phone or email").fill("9800000000");
  await visitor.getByLabel("Message").fill("Can I come in for a check-up?");
  await visitor.getByRole("button", { name: /book|send/i }).click();
  await expect(visitor.getByText("We've received your request")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Can I come in for a check-up?")).toBeVisible();

  // Results: before and after, then the care plan.
  await page.getByRole("link", { name: "Results & care" }).click();
  await page.getByLabel("Address of the finished site").fill(siteUrl);
  await page.getByRole("button", { name: "Check it now" }).click();
  await expect(page.getByText("The before-and-after report is ready")).toBeVisible();
  const reportUrl = await page.getByLabel("Link for the client").first().inputValue();
  await client.goto(reportUrl);
  await expect(client.getByText("had no website. This is the one Test Freelancer built.")).toBeVisible();

  await page.getByLabel("Site to watch").fill(siteUrl);
  await page.getByRole("button", { name: "Start monitoring" }).click();
  // The form gives way to the monitor's status once the first check is in.
  await expect(page.getByText("Up", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check now" })).toBeVisible();
  await client.goto(await page.getByLabel("Link for the client").last().inputValue());
  await expect(client.getByText("Online now")).toBeVisible();
  await expect(client.getByText("100%")).toBeVisible();

  // Payment details, then the invoice.
  await page.goto("/app/settings#payment");
  await page.getByLabel("eSewa ID").fill("9841000001");
  await page.getByLabel("Bank", { exact: true }).fill("Nabil Bank");
  await page.getByRole("button", { name: "Save payment details" }).click();
  await expect(page.getByText("Payment details saved.")).toBeVisible();

  await page.goto(`${leadUrl}/invoices`);
  await expect(page.getByLabel("Line 1 description")).toHaveValue("New website");
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page.getByText("Invoice created.")).toBeVisible();
  const invoiceLink = page.getByRole("link", { name: "INV-0001" });
  await client.goto(await invoiceLink.getAttribute("href").then((h) => h!));
  await expect(client.getByText("Pay NPR 34,000 to Test Freelancer directly.")).toBeVisible();
  await expect(client.getByText("9841000001")).toBeVisible();

  await page.goto("/app/clients");
  await expect(page.getByTestId("outstanding")).toHaveText("NPR 34,000");
  await page.goto(`${leadUrl}/invoices`);
  await page.getByRole("button", { name: "Mark paid" }).click();
  await expect(page.getByText(/^Paid /)).toBeVisible();
  await client.reload();
  await expect(client.getByText(/^Paid /)).toBeVisible();
  await expect(client.getByText("How to pay")).toHaveCount(0);

  await client.close();
  await visitor.close();
});

test("unpublished sites and unknown client links are not found", async ({ page }) => {
  expect((await page.request.get("/s/no-such-site")).status()).toBe(404);
  for (const path of ["/q/nosuchquote", "/i/nosuchinvc", "/p/nosuchcomp", "/m/nosuchmoni"]) {
    expect((await page.goto(path))?.status(), path).toBe(404);
  }
});

test("emailing a lead sets a follow-up that shows on Today", async ({ page }) => {
  const { query } = await import("./helpers");
  await setUpFreelancer(page, `chaser-${Date.now()}@example.com`);
  await page.getByRole("link", { name: "Maple Street Dentist" }).click();
  await page.getByLabel("Status").selectOption("sent");
  await page.getByLabel("Follow up on").fill(new Date().toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();

  await page.goto("/app");
  const due = page.getByRole("region", { name: "Follow up today" });
  await expect(due.getByRole("link", { name: "Maple Street Dentist" })).toBeVisible();
  await due.getByRole("button", { name: "In 3 days" }).click();
  await expect(page.getByRole("region", { name: "Follow up today" })).toHaveCount(0);
  const [row] = await query((sql) => sql`select follow_up_on::text as d from leads where name = 'Maple Street Dentist' order by created_at desc limit 1`);
  expect(row.d).not.toBe(new Date().toISOString().slice(0, 10));
});
