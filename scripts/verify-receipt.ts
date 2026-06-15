// Offline receipt verifier.
//
// Verifies an AgentTrace receipt with no server, no database, and no private
// key — only the receipt JSON itself. Exit code 0 when valid, 1 otherwise.
//
// Usage:
//   pnpm verify:receipt path/to/receipt.json
//   curl -s .../receipt | pnpm verify:receipt        (reads stdin)
import { readFileSync } from "node:fs";
import { verifyReceipt, type Receipt } from "../packages/shared/src/index.js";

function readInput(): string {
  const path = process.argv[2];
  if (path && path !== "-") return readFileSync(path, "utf8");
  return readFileSync(0, "utf8"); // stdin
}

function main(): void {
  let receipt: Receipt;
  try {
    receipt = JSON.parse(readInput()) as Receipt;
  } catch (err) {
    console.error("Failed to read/parse receipt JSON:", (err as Error).message);
    process.exit(2);
  }

  if (!receipt?.body || !receipt.runHash || !receipt.signature || !receipt.signedBy) {
    console.error("Input does not look like a receipt (missing body/runHash/signature/signedBy).");
    process.exit(2);
  }

  const result = verifyReceipt(receipt);

  const ok = (b: boolean) => (b ? "✓" : "✗");
  console.log(`AgentTrace receipt ${receipt.body.version}`);
  console.log(`  run:            ${receipt.body.run.id}`);
  console.log(`  events sealed:  ${receipt.body.eventCount}`);
  console.log(`  risk level:     ${receipt.body.run.riskLevel}`);
  console.log(`  signed by:      ${receipt.signedBy.slice(0, 16)}…`);
  console.log(`  hash valid:     ${ok(result.hashValid)}`);
  console.log(`  signature valid:${ok(result.signatureValid)}`);
  console.log(result.valid ? "\nRECEIPT VALID" : "\nRECEIPT INVALID");

  process.exit(result.valid ? 0 : 1);
}

main();
