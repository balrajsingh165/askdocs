/**
 * Client-side configuration, read from `NEXT_PUBLIC_*` environment variables
 * at build time. Safe to import from client components.
 *
 * @module lib/shared/config
 */

/** Base URL of the FastAPI backend. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** Max documents shown before the upload zone is disabled (UI hint only; the
 * backend enforces the real limit). */
export const MAX_DOCUMENTS = Number(
  process.env.NEXT_PUBLIC_MAX_DOCUMENTS ?? "20",
);
