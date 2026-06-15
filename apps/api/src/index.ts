import { buildApp } from "./app.js";
import { config } from "./config.js";
import { getKeystore } from "./crypto/keystore.js";

async function main(): Promise<void> {
  // Resolve the signing key eagerly so misconfiguration fails fast.
  getKeystore();

  const app = await buildApp({ logger: true });

  try {
    await app.listen({ host: config.host, port: config.port });
    app.log.info(`AgentTrace API listening on http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
