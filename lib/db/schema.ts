import { blob, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Drizzle schema for AskDocs.
 *
 * Every user-owned row carries `userId` so that switching from developer mode
 * to real multi-user auth requires no schema change. Timestamps are Unix
 * milliseconds. Embeddings are stored as raw `Float32Array` buffers.
 *
 * @module lib/db/schema
 */

const now = () => Date.now();

/** Application users. In developer mode this holds a single seeded row. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull().$defaultFn(now),
});

/** Uploaded documents and their processing lifecycle. */
export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    kind: text("kind", { enum: ["pdf", "docx"] }).notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: text("status", {
      enum: ["processing", "ready", "failed"],
    }).notNull(),
    error: text("error"),
    chunkCount: integer("chunk_count").notNull().default(0),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (table) => [index("documents_user_idx").on(table.userId)],
);

/** Text chunks with their embedding vectors. */
export const chunks = sqliteTable(
  "chunks",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: blob("embedding", { mode: "buffer" }).notNull(),
  },
  (table) => [
    index("chunks_user_idx").on(table.userId),
    index("chunks_document_idx").on(table.documentId),
  ],
);

/** Cached full answers keyed by question + corpus + model + prompt version. */
export const answerCache = sqliteTable(
  "answer_cache",
  {
    key: text("key").primaryKey(),
    userId: text("user_id").notNull(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (table) => [index("answer_cache_user_idx").on(table.userId)],
);

/** Cached embedding vectors keyed by chunk text + embedding model. */
export const embeddingCache = sqliteTable("embedding_cache", {
  key: text("key").primaryKey(),
  model: text("model").notNull(),
  embedding: blob("embedding", { mode: "buffer" }).notNull(),
  createdAt: integer("created_at").notNull().$defaultFn(now),
});

/** Individual request events backing the sliding-window rate limiter. */
export const rateLimitEvents = sqliteTable(
  "rate_limit_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subject: text("subject").notNull(),
    route: text("route").notNull(),
    at: integer("at").notNull(),
  },
  (table) => [
    index("rate_limit_subject_route_at_idx").on(
      table.subject,
      table.route,
      table.at,
    ),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type NewDocumentRow = typeof documents.$inferInsert;
export type ChunkRow = typeof chunks.$inferSelect;
export type NewChunkRow = typeof chunks.$inferInsert;
