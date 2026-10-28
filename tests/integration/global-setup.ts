import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import postgres from "postgres";
import { FIXTURE_PORT, INTEGRATION_DB } from "../../vitest.integration.config";

let fixtures: ChildProcess | undefined;

async function waitFor(url: string) {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Fixture server did not start at ${url}`);
}

export async function setup() {
  // Create the database on first run (the test role has CREATEDB).
  const url = new URL(INTEGRATION_DB);
  const dbName = url.pathname.slice(1);
  const admin = postgres({
    host: url.hostname,
    port: Number(url.port || 5432),
    user: url.username,
    password: url.password,
    database: "postgres",
    max: 1,
    onnotice: () => {},
  });
  const [exists] = await admin`select 1 from pg_database where datname = ${dbName}`;
  if (!exists) await admin.unsafe(`create database "${dbName}"`);
  await admin.end();

  execFileSync("npx", ["tsx", "scripts/migrate.mts"], { env: { ...process.env, DATABASE_URL: INTEGRATION_DB }, stdio: "inherit" });

  fixtures = spawn("node", ["e2e/fixture-sites/server.mjs"], { env: { ...process.env, FIXTURE_PORT: String(FIXTURE_PORT) }, stdio: "ignore" });
  await waitFor(`http://127.0.0.1:${FIXTURE_PORT}/good.html`);
}

export async function teardown() {
  fixtures?.kill();
}
