import path from "node:path";
import { defineConfig } from "vitest/config";

export const INTEGRATION_DB = process.env.INTEGRATION_DATABASE_URL ?? "postgres://pitchcraft:pitchcraft@localhost:5432/pitchcraft_integration";
export const FIXTURE_PORT = 4101;

// Runs the real database-backed services against Postgres and local fixture websites.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // The real package throws outside React Server Components.
      "server-only": path.resolve(__dirname, "tests/integration/server-only-stub.ts"),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/integration/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      DATABASE_URL: INTEGRATION_DB,
      LEADS_PROVIDER: "mock",
      MOCK_SITE_BASE: `http://127.0.0.1:${FIXTURE_PORT}`,
      AUDIT_ALLOW_PRIVATE_HOSTS: "1",
      PAGESPEED_DISABLED: "1",
      ANTHROPIC_API_KEY: "",
      APP_URL: "http://localhost:3000",
    },
  },
});
