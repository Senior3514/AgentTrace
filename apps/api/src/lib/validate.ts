import type { z, ZodTypeAny } from "zod";
import { badRequest } from "./errors.js";

/**
 * Parse a payload against a Zod schema, raising a 400 AppError on failure.
 * Returns the schema's *output* type (defaults applied), not the input type.
 */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest("Validation failed", result.error.flatten());
  }
  return result.data;
}
