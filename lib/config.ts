import { z } from "zod";
import type { DocumentKind } from "@/lib/shared/types";

export type { DocumentKind };

/**
 * Centralised application configuration and constants.
 *
 * This is the **only** module that reads `process.env`. Everything else
 * imports the typed values exported here. Environment variables are validated
 * once, at module load, with zod.
 *
 * @module lib/config
 */

/**
 * The exact message returned when the uploaded documents do not contain enough
 * information to answer a question. This literal must never be duplicated
 * elsewhere in the codebase — import this constant instead.
 */
export const NO_CONTEXT_MESSAGE =
  "I don't have enough context in the uploaded document(s) to answer that question.";

/** Claude model used for answer generation. */
export const CLAUDE_MODEL = "claude-opus-4-8";

/** Upper bound on generated answer length, in tokens. */
export const CLAUDE_MAX_TOKENS = 1024;

/** Local sentence-embedding model (Transformers.js, runs in-process). */
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

/** Output dimensionality of {@link EMBEDDING_MODEL}. */
export const EMBEDDING_DIMENSIONS = 384;

/**
 * Prompt version. Bumped whenever the system/user prompt changes so that the
 * answer cache key changes and stale answers are never served.
 */
export const PROMPT_VERSION = "1";

/** Target chunk size (characters) when splitting extracted document text. */
export const CHUNK_SIZE = 1200;

/** Overlap (characters) between consecutive chunks. */
export const CHUNK_OVERLAP = 200;

/** Accepted upload types, keyed by both MIME type and file extension. */
export const ACCEPTED_UPLOAD_TYPES: ReadonlyArray<{
  kind: DocumentKind;
  mimeType: string;
  extension: string;
}> = [
  { kind: "pdf", mimeType: "application/pdf", extension: ".pdf" },
  {
    kind: "docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: ".docx",
  },
];

const booleanFromEnv = (defaultValue: boolean) =>
  z
    .enum(["true", "false"])
    .default(defaultValue ? "true" : "false")
    .transform((value) => value === "true");

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  AUTH_MODE: z.enum(["developer", "full"]).default("developer"),
  DEVELOPER_NAME: z.string().min(1).default("Developer"),
  SQLITE_PATH: z.string().min(1).default("data/askdocs.db"),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(20),
  MAX_DOCUMENTS: z.coerce.number().int().positive().default(20),
  TOP_K: z.coerce.number().int().positive().default(8),
  SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.35),
  RATE_LIMIT_ASK_PER_MINUTE: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_DOCUMENTS_PER_MINUTE: z.coerce
    .number()
    .int()
    .positive()
    .default(30),
  ANSWER_CACHE_ENABLED: booleanFromEnv(true),
  EMBEDDING_CACHE_ENABLED: booleanFromEnv(true),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const env = parsed.data;

/**
 * The validated, typed application configuration. Import this object (or the
 * individual constants above) rather than reading `process.env` directly.
 */
export const config = {
  anthropicApiKey: env.ANTHROPIC_API_KEY,
  authMode: env.AUTH_MODE,
  developerName: env.DEVELOPER_NAME,
  sqlitePath: env.SQLITE_PATH,
  maxFileSizeBytes: env.MAX_FILE_SIZE_MB * 1024 * 1024,
  maxDocuments: env.MAX_DOCUMENTS,
  topK: env.TOP_K,
  similarityThreshold: env.SIMILARITY_THRESHOLD,
  rateLimitAskPerMinute: env.RATE_LIMIT_ASK_PER_MINUTE,
  rateLimitDocumentsPerMinute: env.RATE_LIMIT_DOCUMENTS_PER_MINUTE,
  answerCacheEnabled: env.ANSWER_CACHE_ENABLED,
  embeddingCacheEnabled: env.EMBEDDING_CACHE_ENABLED,
} as const;

/** Static type of the {@link config} object. */
export type AppConfig = typeof config;
