import { expect, test } from "@playwright/test";
import { logIn, PASSWORD, query, setUpFreelancer, signUp } from "./helpers";

test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const alice = `alice-${stamp}@example.com`;
const bob = `bob-${stamp}@example.com`;
const nepali = `sita-${stamp}@example.com`;

const DAY = 86_400_000;

test("paying NPR with Khalti activates 30 days of Pro, exactly once", async ({ page }) => {
  await signUp(page, nepali, "Sita Sharma");
  await page.goto("/app/billing");
  await expect(page.getByTestId("current-plan")).toHaveText("Free");

  await page.getByRole("button", { name: "Pay NPR 999" }).click();
  // Fake Khalti takes the payment and sends the customer back.
  await expect(page).toHaveURL(/\/app\/billing\?status=success/);
  await expect(page.locator("p[role=status]")).toContainText("Payment received. You're on Pro.");
  await expect(page.getByTestId("current-plan")).toHaveText("Pro");
  await expect(page.getByText("Paid until")).toBeVisible();

  const [payment] = await query((sql) => sql`
    select p.provider_ref, p.status, p.amount_minor, p.currency, u.pro_until
    from payments p join users u on u.id = p.user_id where u.email = ${nepali}`);
  expect(payment).toMatchObject({ status: "completed", amount_minor: 99_900, currency: "NPR" });
  const days = (d: Date) => Math.round((d.getTime() - Date.now()) / DAY);
  expect(days(payment.pro_until as Date)).toBe(30);

  // Revisiting the return link (refresh, back button) must not add another 30 days.
  await page.goto(`/api/billing/khalti/callback?pidx=${payment.provider_ref}&status=Completed`);
  await expect(page).toHaveURL(/status=success/);
  const [after] = await query((sql) => sql`select pro_until from users where email = ${nepali}`);
  expect(days(after.pro_until as Date)).toBe(30);
});

test("a Khalti payment that Khalti doesn't know about never activates Pro", async ({ page }) => {
  await signUp(page, alice, "Alice Gurung");
  const [user] = await query((sql) => sql`select id from users where email = ${alice}`);
  await query((sql) => sql`
    insert into payments (user_id, provider, provider_ref, status, amount_minor, currency)
    values (${user.id as string}, 'khalti', 'never-paid', 'pending', 99900, 'NPR') returning id`);

  await page.goto("/api/billing/khalti/callback?pidx=never-paid&status=Completed");
  await expect(page).toHaveURL(/status=pending/);
  await expect(page.getByTestId("current-plan")).toHaveText("Free");
});

test("freelancers can never open each other's leads", async ({ page, browser }) => {
  await logIn(page, alice, PASSWORD);
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/settings");
  await page.getByLabel("Type of business").selectOption("dentist");
  await page.getByLabel("City").fill("Kathmandu, Nepal");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator("p[role=status]")).toHaveText("Saved.");
  await page.goto("/app");
  await page.getByRole("button", { name: "Find today's leads" }).click();
  await expect(page.getByRole("link", { name: /Dentist/ })).toHaveCount(5, { timeout: 30_000 });
  const [aliceLead] = await query((sql) => sql`
    select l.id from leads l join users u on u.id = l.user_id where u.email = ${alice} limit 1`);

  const bobContext = await browser.newContext();
  const bobPage = await bobContext.newPage();
  await setUpFreelancer(bobPage, bob);
  await bobPage.goto(`/app/leads/${aliceLead.id}`);
  await expect(bobPage.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await bobPage.goto("/app/leads/not-a-real-id");
  await expect(bobPage.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await bobContext.close();
});

test("free users get 10 pitches a week, then see an upgrade message", async ({ page }) => {
  await logIn(page, bob, PASSWORD);
  await expect(page).toHaveURL(/\/app$/);
  const [user] = await query((sql) => sql`select id from users where email = ${bob}`);
  await query((sql) => sql`
    insert into pitches (user_id, subject, body, model)
    select ${user.id as string}, 's', 'b', 'template' from generate_series(1, 10) returning id`);

  await page.getByRole("link", { name: /Dentist/ }).first().click();
  await page.getByRole("button", { name: "Draft the email" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("That's your 10 free drafts for this week");
});

test("changing settings updates the search", async ({ page }) => {
  await logIn(page, bob, PASSWORD);
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/settings");
  await expect(page.getByLabel("City")).toHaveValue("Kathmandu, Nepal");
  await page.getByLabel("Type of business").selectOption("cafe");
  await page.getByLabel("City").fill("Pokhara, Nepal");
  await page.getByLabel("Distance").selectOption("25");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator("p[role=status]")).toHaveText("Saved.");
  await page.goto("/app");
  await expect(page.getByText("Cafés within 25 km of Pokhara, Nepal.")).toBeVisible();

  const searches = await query((sql) => sql`
    select s.active from searches s join users u on u.id = s.user_id where u.email = ${bob}`);
  expect(searches.filter((s) => s.active)).toHaveLength(1);
});

test("login never redirects to another website", async ({ page }) => {
  await page.goto("/login?next=//evil.example/steal");
  await page.getByLabel("Email").fill(bob);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/^http:\/\/localhost:3100\/app$/);
});

test("signed-out visitors are sent to log in for every app page", async ({ page }) => {
  for (const path of ["/app", "/app/pipeline", "/app/settings", "/app/billing", "/app/leads/123"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
  }
});

test("a report link that doesn't exist shows a friendly 404", async ({ page }) => {
  const res = await page.goto("/r/doesnotexist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test.describe("anonymous free checks", () => {
  // A dedicated IP so other tests' checks don't count against this one.
  test.use({ extraHTTPHeaders: { "x-forwarded-for": "203.0.113.77" } });

  test("are limited to 5 per hour per visitor", async ({ page }) => {
    for (let i = 1; i <= 5; i++) {
      await page.goto("/");
      await page.getByLabel("Business website").fill("http://127.0.0.1:4100/good.html");
      await page.getByRole("button", { name: "Check this site" }).click();
      await expect(page).toHaveURL(/\/r\//);
    }
    await page.goto("/");
    await page.getByLabel("Business website").fill("http://127.0.0.1:4100/good.html");
    await page.getByRole("button", { name: "Check this site" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("That's five free checks this hour");
    // What they typed is kept so they don't lose it.
    await expect(page.getByLabel("Business website")).toHaveValue("http://127.0.0.1:4100/good.html");
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no page is wider than the screen", async ({ page }) => {
    const fits = async (path: string) => {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    };
    for (const path of ["/", "/signup", "/login", "/forgot-password", "/terms", "/privacy", "/refund"]) await fits(path);

    await logIn(page, bob, PASSWORD);
    await expect(page).toHaveURL(/\/app$/);
    for (const path of ["/app", "/app/pipeline", "/app/clients", "/app/settings", "/app/billing"]) await fits(path);
    await page.goto("/app");
    await page.getByRole("link", { name: /Dentist/ }).first().click();
    await expect(page.getByRole("heading", { name: "Their website" })).toBeVisible();
    const lead = new URL(page.url()).pathname;
    for (const tab of ["", "/quote", "/site", "/care", "/invoices"]) await fits(`${lead}${tab}`);

    // The pages a freelancer's client opens.
    await page.goto(`${lead}/quote`);
    await page.getByRole("button", { name: "Build the quote" }).click();
    const quoteUrl = await page.getByLabel("Link for the client").inputValue();
    await page.goto(`${lead}/site`);
    await page.getByRole("button", { name: "Start the website" }).click();
    await page.getByRole("button", { name: "Publish" }).click();
    const siteUrl = await page.getByLabel("Link for the client").inputValue();
    await fits(`${lead}/site`);
    await fits(new URL(quoteUrl).pathname);
    await fits(new URL(siteUrl).pathname);
  });
});
