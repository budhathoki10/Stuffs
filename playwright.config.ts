import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://pitchcraft:pitchcraft@localhost:5432/pitchcraft_test";

// The app runs against a separate database with fake businesses and local fixture websites.
const appEnv = {
  DATABASE_URL: TEST_DATABASE_URL,
  APP_URL: `http://localhost:${PORT}`,
  LEADS_PROVIDER: "mock",
  MOCK_SITE_BASE: "http://127.0.0.1:4100",
  AUDIT_ALLOW_PRIVATE_HOSTS: "1",
  PAGESPEED_DISABLED: "1",
  ANTHROPIC_API_KEY: "",
  CRON_SECRET: "e2e-cron-secret",
  PADDLE_WEBHOOK_SECRET: "e2e-paddle-secret",
  KHALTI_SECRET_KEY: "",
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/fixture-sites/server.mjs",
      url: "http://127.0.0.1:4100/good.html",
      reuseExistingServer: true,
    },
    {
      command: `npm run build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      env: appEnv,
      timeout: 240_000,
      reuseExistingServer: false,
    },
  ],
});
