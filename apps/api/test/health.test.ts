import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("health endpoint", () => {
  it("builds the app without a top-level DB connection and reports liveness", async () => {
    // buildApp() must not throw even though the Prisma client is lazy — this is
    // what keeps the serverless function from crashing at cold start.
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    // In the test environment the DB is reachable.
    expect(body.db).toBe("up");
    await app.close();
  });
});
