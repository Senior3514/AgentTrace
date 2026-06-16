import { buildApp } from "./app.js";
import { config } from "./config.js";
import { getKeystore } from "./crypto/keystore.js";
import { autoSeedIfEmpty } from "./services/demo.js";

async function main(): Promise<void> {
  // Resolve the signing key eagerly so misconfiguration fails fast.
  getKeystore();

  const app = await buildApp({ logger: true });

  // DEMO_MODE: make the product demonstrate itself. If the database is empty,
  // seed it so a fresh deploy is immediately non-empty and interesting.
  if (config.demoMode) {
    try {
      const seeded = await autoSeedIfEmpty();
      app.log.info(
        seeded
          ? `DEMO_MODE: seeded ${seeded.runs.length} runs for owner ${seeded.ownerId}`
          : "DEMO_MODE: database already has data; skipping auto-seed",
      );
    } catch (err) {
      app.log.error({ err }, "DEMO_MODE auto-seed failed");
    }
  }

  try {
    await app.listen({ host: config.host, port: config.port });
    app.log.info(`AgentTrace API listening on http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
