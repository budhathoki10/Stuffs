import { execFileSync } from "node:child_process";
import postgres from "postgres";
import { TEST_DATABASE_URL } from "../playwright.config";

export default async function globalSetup() {
  execFileSync("npx", ["tsx", "scripts/migrate.mts"], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
  const sql = postgres(TEST_DATABASE_URL, { max: 1 });
  await sql`truncate users, sessions, searches, audits, leads, pitches, payments cascade`;
  await sql.end();
}
