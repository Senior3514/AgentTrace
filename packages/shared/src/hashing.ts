import { createHash } from "node:crypto";

/**
 * Deterministic JSON canonicalization.
 *
 * Rules:
 *  - object keys are sorted lexicographically (recursively)
 *  - `undefined` values and function/symbol values are dropped
 *  - arrays preserve order
 *  - everything else uses standard JSON semantics
 *
 * The output is a stable string: the same logical value always produces the
 * same bytes, regardless of key insertion order. This is the foundation of
 * deterministic event hashing and receipt generation.
 */
export function canonicalize(value: unknown): string {
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null) return "null";

  const t = typeof value;

  if (t === "number") {
    if (!Number.isFinite(value as number)) return "null";
    return JSON.stringify(value);
  }
  if (t === "boolean" || t === "string") {
    return JSON.stringify(value);
  }
  if (t === "bigint") {
    return JSON.stringify((value as bigint).toString());
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => serialize(normalizeUndefined(v))).join(",")}]`;
  }
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined && typeof obj[k] !== "function")
      .sort();
    const parts = keys.map(
      (k) => `${JSON.stringify(k)}:${serialize(obj[k])}`,
    );
    return `{${parts.join(",")}}`;
  }
  // undefined / function / symbol — should be filtered by callers; fall back.
  return "null";
}

function normalizeUndefined(v: unknown): unknown {
  return v === undefined ? null : v;
}

/** Hex-encoded SHA-256 of an arbitrary string. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Hex-encoded SHA-256 of a canonicalized value. */
export function hashCanonical(value: unknown): string {
  return sha256Hex(canonicalize(value));
}

/**
 * Compute a chained event hash.
 *
 * eventHash = SHA-256( canonical(eventCore) + "." + (prevEventHash ?? "") )
 *
 * The previous hash is folded in so the sequence forms a tamper-evident chain:
 * changing any earlier event invalidates every hash after it.
 */
export function chainEventHash(
  eventCore: unknown,
  prevEventHash: string | null,
): string {
  return sha256Hex(`${canonicalize(eventCore)}.${prevEventHash ?? ""}`);
}
