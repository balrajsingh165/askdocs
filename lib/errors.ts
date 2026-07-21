/**
 * Domain errors thrown by services. Each carries the HTTP status the route
 * layer should map it to, so route handlers can translate any {@link AppError}
 * to a response uniformly without knowing the specific subclass.
 *
 * @module lib/errors
 */

/** Base class for all expected, domain-level failures. */
export abstract class AppError extends Error {
  /** HTTP status this error maps to. */
  abstract readonly status: number;
  /** Stable machine-readable error code. */
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Input failed validation (bad request body, wrong file type, etc.). */
export class ValidationError extends AppError {
  readonly status = 400;
  readonly code = "validation_error";
}

/** No authenticated user could be resolved. */
export class UnauthorizedError extends AppError {
  readonly status = 401;
  readonly code = "unauthorized";
}

/** A referenced resource does not exist (or is not owned by the user). */
export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = "not_found";
}

/** The request cannot proceed in the current state (e.g. no ready documents). */
export class ConflictError extends AppError {
  readonly status = 409;
  readonly code = "conflict";
}

/** The uploaded file exceeds the configured size limit. */
export class PayloadTooLargeError extends AppError {
  readonly status = 413;
  readonly code = "payload_too_large";
}

/** Document text could not be extracted (encrypted, empty, or corrupt file). */
export class ExtractionError extends AppError {
  readonly status = 422;
  readonly code = "extraction_error";
}

/** Too many requests from the same subject within the rate-limit window. */
export class RateLimitError extends AppError {
  readonly status = 429;
  readonly code = "rate_limited";

  /**
   * @param retryAfterSeconds Seconds the client should wait before retrying,
   *   surfaced as the `Retry-After` response header.
   */
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super(message);
  }
}

/** Answer generation failed (missing API key, upstream error, etc.). */
export class GenerationError extends AppError {
  readonly status = 500;
  readonly code = "generation_error";
}

/**
 * Narrow an unknown thrown value to an {@link AppError}.
 *
 * @param error - Any caught value.
 * @returns `true` when `error` is an {@link AppError}.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
