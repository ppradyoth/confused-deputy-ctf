import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  /**
   * BYOK live-mode SDKs are optional deps, installed only when a player
   * exercises live mode against a given provider. External so the bundler
   * doesn't try to resolve them at build time.
   */
  serverExternalPackages: ["@anthropic-ai/sdk", "openai", "firebase-admin"],
};

export default nextConfig;
