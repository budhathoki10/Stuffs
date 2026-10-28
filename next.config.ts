import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pitchcraft is almost entirely per-user, request-time UI, so it uses the
  // classic dynamic rendering model instead of Cache Components.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
};

export default nextConfig;
