import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import postgres from "postgres";
import { EMAIL_OUTBOX, TEST_DATABASE_URL } from "../playwright.config";

export const PASSWORD = "correct-horse-battery";

export async function logIn(page: Page, address: string, pass: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(address);
  await page.getByLabel("Password").fill(pass);
  await page.getByRole("button", { name: "Log in" }).click();
}

export async function signUp(page: Page, address: string, name = "Test Freelancer") {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(address);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel("I agree to the Terms").check();
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page).toHaveURL(/\/app\/settings\?welcome=1/);
}

/** Sign up, choose a search, and receive the first 5 leads. */
export async function setUpFreelancer(page: Page, address: string) {
  await signUp(page, address);
  await page.getByLabel("Type of business").selectOption("dentist");
  await page.getByLabel("City").fill("Kathmandu, Nepal");
  await page.getByRole("button", { name: "Save and get my leads" }).click();
  await expect(page).toHaveURL(/\/app\?first=1/);
  await page.getByRole("button", { name: "Find my leads now" }).click();
  await expect(page.getByRole("link", { name: /Dentist/ })).toHaveCount(5, { timeout: 30_000 });
}

/** The link in the newest email sent to `to` whose subject contains `subject`. */
export function latestEmailLink(to: string, subject: string): string {
  const emails = readFileSync(EMAIL_OUTBOX, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { to: string; subject: string; text: string })
    .filter((e) => e.to === to && e.subject.includes(subject));
  const link = emails.at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`No "${subject}" email for ${to}`);
  return link;
}

/** Run one query against the test database. */
export async function query<T extends Record<string, unknown>>(
  run: (sql: postgres.Sql) => Promise<T[]>,
): Promise<T[]> {
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}
