import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    /** Owner resolved from a per-owner API key, if used. */
    ownerId: string | null;
    /** Id of the per-owner API key used, if any. */
    apiKeyId: string | null;
    /** Which credential authorized the request. */
    authScope: "global" | "owner" | null;
  }
}
