import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { TEST_DATABASE_URL } from "../playwright.config";

const email = `freelancer-${Date.now()}@example.com`;
const password = "correct-horse-battery";

test.describe.configure({ mode: "serial" });

test("visitor can audit a website and get a sample pitch without signing up", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Stop bidding on Upwork");
  await page.getByLabel("Business website").fill("http://127.0.0.1:4100/old.html");
  await page.getByRole("button", { name: "Check website free" }).click();

  await expect(page).toHaveURL(/\/r\/[a-z0-9]{10}$/);
  await expect(page.getByText("Losing customers")).toBeVisible();
  await expect(page.getByText("✗ Works on phones")).toBeVisible();
  await expect(page.getByText("The footer says © 2017.")).toBeVisible();

  await page.getByRole("button", { name: "Write a sample pitch" }).click();
  const body = page.getByLabel("Pitch body");
  await expect(body).toBeVisible();
  await expect(body).toHaveValue(/Hi .* team,/);
  await expect(page.getByRole("link", { name: "Open in Gmail" })).toHaveAttribute("href", /mail\.google\.com/);
});

test("rejects non-web URLs in the free audit", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Business website").fill("ftp://example.com");
  await page.getByRole("button", { name: "Check website free" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("doesn't look like a public website");
});

test("freelancer signs up, gets leads, pitches, and tracks a win", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp/);

  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Kushal Budhathoki");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create free account" }).click();

  await expect(page).toHaveURL(/\/app\/settings\?welcome=1/);
  await page.getByLabel("Type of business").selectOption("dentist");
  await page.getByLabel("City").fill("Kathmandu, Nepal");
  await page.getByLabel("Portfolio or website").fill("kushal.dev");
  await page.getByRole("button", { name: "Save and get my leads" }).click();

  await expect(page).toHaveURL(/\/app\?first=1/);
  await page.getByRole("button", { name: "Find my leads now" }).click();

  const leads = page.getByRole("link", { name: /Dentist/ });
  await expect(leads).toHaveCount(5, { timeout: 30_000 });
  // Web developers see businesses without a website first.
  await expect(leads.first()).toContainText("No website");
  await expect(page.getByTestId("stat-leads")).toHaveText("5");

  // Open a lead that has a website, so the audit and report are shown.
  await page.getByRole("link", { name: /Maple Street Dentist/ }).click();
  await expect(page.getByRole("heading", { name: "Maple Street Dentist" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Shareable report ↗" })).toBeVisible();
  await expect(page.getByText("hello@maple.test").first()).toBeVisible();

  await page.getByRole("button", { name: "Write my pitch" }).click();
  await expect(page.getByLabel("Pitch body")).toHaveValue(/Kushal Budhathoki\nhttps:\/\/kushal\.dev/);
  await expect(page.getByRole("link", { name: "Open in Gmail" })).toHaveAttribute("href", /to=hello%40maple\.test/);

  await page.getByLabel("Status").selectOption("won");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("How much is the project worth");
  await page.getByLabel("Project value (USD)").fill("750");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Marked as won. Nice work!")).toBeVisible();

  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page.getByTestId("stat-earned")).toHaveText("$750");
  await expect(page.getByTestId("stat-pitched")).toHaveText("1");

  await page.getByRole("link", { name: "Pipeline", exact: true }).click();
  const won = page.getByRole("region", { name: "Won" });
  await expect(won).toContainText("Maple Street Dentist");
  await expect(won).toContainText("$750");

  // Quick action from the board.
  const newColumn = page.getByRole("region", { name: "New" });
  await newColumn.getByRole("button", { name: "Mark pitch sent" }).first().click();
  await expect(page.getByRole("region", { name: "Pitch sent" }).getByRole("listitem")).toHaveCount(1);
});

test("cron endpoint requires the secret", async ({ request }) => {
  expect((await request.get("/api/cron/daily-leads")).status()).toBe(401);
  const res = await request.get("/api/cron/daily-leads", { headers: { authorization: "Bearer e2e-cron-secret" } });
  expect(res.status()).toBe(200);
  // The only user already received this week's free leads.
  expect(await res.json()).toMatchObject({ users: 1, delivered: 0, failed: 0 });
});

test("a signed Paddle webhook upgrades the account to Pro", async ({ page, request }) => {
  const sql = postgres(TEST_DATABASE_URL, { max: 1 });
  const [user] = await sql`select id from users where email = ${email}`;
  await sql.end();

  const body = JSON.stringify({
    event_id: "evt_e2e",
    event_type: "subscription.created",
    data: {
      id: "sub_e2e",
      status: "active",
      custom_data: { userId: user.id },
      current_billing_period: { ends_at: new Date(Date.now() + 30 * 86_400_000).toISOString() },
    },
  });
  const ts = Math.floor(Date.now() / 1000);
  const h1 = createHmac("sha256", "e2e-paddle-secret").update(`${ts}:${body}`).digest("hex");

  const forged = await request.post("/api/webhooks/paddle", { data: body, headers: { "paddle-signature": `ts=${ts};h1=${"0".repeat(64)}`, "content-type": "application/json" } });
  expect(forged.status()).toBe(401);
  const ok = await request.post("/api/webhooks/paddle", { data: body, headers: { "paddle-signature": `ts=${ts};h1=${h1}`, "content-type": "application/json" } });
  expect(ok.status()).toBe(200);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/billing");
  await expect(page.getByTestId("current-plan")).toHaveText("Pro");
  await expect(page.getByRole("banner").getByText("Pro", { exact: true })).toBeVisible();
});

test("Khalti callback with an unknown payment is rejected", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/api/billing/khalti/callback?pidx=forged&status=Completed");
  await expect(page).toHaveURL(/\/app\/billing\?status=failed/);
  await expect(page.locator("p[role=alert]")).toContainText("didn't go through");
});
