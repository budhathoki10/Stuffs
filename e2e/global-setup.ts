import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import postgres from "postgres";
import { EMAIL_OUTBOX, TEST_DATABASE_URL } from "../playwright.config";

export default async function globalSetup() {
  execFileSync("npx", ["tsx", "scripts/migrate.mts"], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await sql`truncate users, sessions, auth_tokens, searches, audits, leads, pitches, payments, quotes, sites, site_messages, comparisons, monitors, monitor_checks, invoices, messages, suppressions cascade`;
  await sql.end();
  rmSync(EMAIL_OUTBOX, { force: true });
}
