import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("security headers", () => {
  it("sets hardening headers on responses", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    // From @fastify/helmet
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["referrer-policy"]).toBeDefined();
    // Cross-origin reads must remain allowed so the dashboard can call the API.
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    await app.close();
  });
});
