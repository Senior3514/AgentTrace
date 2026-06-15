const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@agenttrace/shared"],
  // Trace files from the monorepo root so the standalone output is complete.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  experimental: {
    // The shared package is consumed as TypeScript source from the monorepo.
    externalDir: true,
  },
  webpack: (config) => {
    // The shared package uses ESM `.js` import specifiers that resolve to `.ts`
    // sources. Teach webpack to map them.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

module.exports = nextConfig;
