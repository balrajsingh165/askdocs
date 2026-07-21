import { NextResponse } from "next/server";
import type { z } from "zod";
import { isAppError, RateLimitError, ValidationError } from "@/lib/errors";

/**
 * Shared route-layer helpers: mapping domain errors to HTTP responses and
 * validating request bodies.
 *
 * @module lib/http
 */

/**
 * Convert any thrown value into an HTTP error response. Known {@link AppError}s
 * map to their declared status; a {@link RateLimitError} also sets
 * `Retry-After`. Everything else becomes a sanitised 500.
 *
 * @param error - The caught value.
 * @returns A JSON error response.
 */
export function errorResponse(error: unknown): NextResponse {
  if (isAppError(error)) {
    const headers = new Headers();
    if (error instanceof RateLimitError) {
      headers.set("Retry-After", String(error.retryAfterSeconds));
    }
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers },
    );
  }

  console.error("[askdocs] Unhandled error:", error);
  return NextResponse.json(
    { error: { code: "internal_error", message: "An unexpected error occurred." } },
    { status: 500 },
  );
}

/**
 * Parse and validate a JSON request body against a zod schema.
 *
 * @param request - The incoming request.
 * @param schema - The zod schema to validate against.
 * @returns The parsed, typed body.
 * @throws {ValidationError} When the body is not valid JSON or fails the schema.
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues.map((issue) => issue.message).join("; "),
    );
  }
  return result.data;
}
