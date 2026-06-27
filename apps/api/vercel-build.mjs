// Bundle the Vercel serverless handler with esbuild.
//
// Only the workspace package @agenttrace/shared (TypeScript source) is inlined.
// Everything else - fastify, @prisma/client, zod, node builtins - stays external
// and is required normally from node_modules at runtime. This avoids Vercel's
// builder having to resolve TS sources or package `exports`, which produced
// TS2305/TS2339 errors on a raw .ts function.

import { build } from "esbuild";

const onlyBundleWorkspace = {
  name: "externalize-non-workspace",
  setup(b) {
    // Any bare specifier (not starting with "." or "/") that is NOT one of our
    // workspace packages is marked external.
    b.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path.startsWith("@agenttrace/")) return undefined; // bundle (inline TS)
      return { path: args.path, external: true };
    });
  },
};

await build({
  entryPoints: ["src/vercel-handler.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "api/_server.js",
  plugins: [onlyBundleWorkspace],
  logLevel: "info",
});

console.log("Bundled api/_server.js (workspace inlined, deps external).");
