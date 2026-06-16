// @ts-nocheck
// Vercel serverless entry. The real handler is bundled (esbuild) into
// ./_server.js during the build (see ../vercel.json buildCommand) so that the
// workspace package @agenttrace/shared is inlined and Vercel never resolves TS
// sources. @prisma/client and other deps stay external (required at runtime).
export { default } from "./_server.js";
