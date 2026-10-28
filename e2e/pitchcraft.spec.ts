import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { TEST_DATABASE_URL } from "../playwright.config";
import { latestEmailLink, logIn, PASSWORD as password } from "./helpers";

const email = `freelancer-${Date.now()}@example.com`;
const newPassword = "even-better-passphrase";

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
  await page.getByLabel("I agree to the Terms").check();
  await page.getByRole("button", { name: "Create free account" }).click();

  await expect(page).toHaveURL(/\/app\/settings\?welcome=1/);
  await expect(page.getByText(`Please confirm your email: we sent a link to ${email}.`)).toBeVisible();
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
  expect((await request.get("/api/cron/daily-leads", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
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

  await logIn(page, email, password);
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/billing");
  await expect(page.getByTestId("current-plan")).toHaveText("Pro");
  await expect(page.getByRole("banner").getByText("Pro", { exact: true })).toBeVisible();
});

test("Khalti callback with an unknown payment is rejected", async ({ page }) => {
  await logIn(page, email, password);
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/api/billing/khalti/callback?pidx=forged&status=Completed");
  await expect(page).toHaveURL(/\/app\/billing\?status=failed/);
  await expect(page.locator("p[role=alert]")).toContainText("didn't go through");
});

test("the emailed link confirms the address and works only once", async ({ page }) => {
  await logIn(page, email, password);
  await expect(page.getByText("Please confirm your email")).toBeVisible();
  const link = latestEmailLink(email, "Confirm your Pitchcraft email");

  await page.goto(link);
  await expect(page).toHaveURL(/\/app\?verified=1/);
  await expect(page.locator("p[role=status]")).toHaveText("Email confirmed. Thanks!");
  await expect(page.getByText("Please confirm your email")).toHaveCount(0);

  await page.goto(link);
  await expect(page.locator("p[role=alert]")).toContainText("expired or was already used");
});

test("forgotten password can be reset by email", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.locator("p[role=status]")).toContainText("If an account exists");

  // Unknown emails get the same answer, so accounts can't be discovered this way.
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.locator("p[role=status]")).toContainText("If an account exists");

  const link = latestEmailLink(email, "Reset your Pitchcraft password");
  await page.goto(link);
  await page.locator("input[name=password]").fill(newPassword);
  await page.locator("input[name=confirm]").fill("something-else");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText("The two passwords don't match");

  // The typed password survives the error, so only the repeat field needs fixing.
  await expect(page.locator("input[name=password]")).toHaveValue(newPassword);
  await page.locator("input[name=confirm]").fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/app\?reset=1/);
  await expect(page.locator("p[role=status]")).toContainText("Your password was changed");

  await page.goto(link);
  await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();

  await page.context().clearCookies();
  await logIn(page, email, password);
  await expect(page.locator("p[role=alert]")).toHaveText("Wrong email or password.");
  await logIn(page, email, newPassword);
  await expect(page).toHaveURL(/\/app$/);
});

test("legal pages are reachable from the footer", async ({ page }) => {
  await page.goto("/");
  const legal = page.getByRole("navigation", { name: "Legal" });
  for (const [link, heading] of [
    ["Terms", "Terms of Service"],
    ["Privacy", "Privacy Policy"],
    ["Refunds", "Refund Policy"],
  ]) {
    await legal.getByRole("link", { name: link }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  }
  await expect(page.getByText("14-day money-back guarantee")).toBeVisible();
});

test("a paying user can't delete the account until the subscription is canceled", async ({ page }) => {
  await logIn(page, email, newPassword);
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/settings");
  await page.getByLabel("Confirm with your password").fill(newPassword);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("couldn't cancel your subscription");
});

test("a free user can delete the account and all data", async ({ page }) => {
  const doomed = `delete-me-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Temp User");
  await page.getByLabel("Email").fill(doomed);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("I agree to the Terms").check();
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page).toHaveURL(/welcome=1/);

  await page.goto("/app/settings");
  await page.getByLabel("Confirm with your password").fill("wrong-password");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText("That password isn't right.");

  await page.getByLabel("Confirm with your password").fill(password);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/\?deleted=1$/);
  await expect(page.locator("p[role=status]")).toContainText("Your account and data have been deleted");

  const sql = postgres(TEST_DATABASE_URL, { max: 1 });
  const rows = await sql`select id from users where email = ${doomed}`;
  await sql.end();
  expect(rows).toHaveLength(0);

  await logIn(page, doomed, password);
  await expect(page.locator("p[role=alert]")).toHaveText("Wrong email or password.");
});
