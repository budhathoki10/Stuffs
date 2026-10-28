import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // The real package throws outside React Server Components.
      "server-only": path.resolve(__dirname, "tests/integration/server-only-stub.ts"),
    },
  },
  test: {
    include: ["tests/*.test.ts"],
    environment: "node",
  },
});
