import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config, NO_CONTEXT_MESSAGE } from "@/lib/config";
import { requireUser, subjectForUser } from "@/lib/auth/session";
import {
  answerCacheKey,
  getCachedAnswer,
  setCachedAnswer,
} from "@/lib/cache/answer-cache";
import { db } from "@/lib/db/client";
import { listReadyDocumentIds } from "@/lib/db/repositories/documents";
import { ConflictError, ValidationError } from "@/lib/errors";
import { errorResponse, parseJsonBody } from "@/lib/http";
import { streamAnswer } from "@/lib/rag/generation";
import { retrieveContext } from "@/lib/rag/retrieval";
import { enforceRateLimit } from "@/lib/ratelimit/limiter";

export const runtime = "nodejs";

/** How the answer was produced, surfaced to the client via a response header. */
type AnswerSource = "cache" | "generated" | "no_context";

const askSchema = z.object({
  question: z.string().max(4000),
});

/** Build a plain-text response for an already-known answer. */
function textResponse(text: string, source: AnswerSource): NextResponse {
  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-AskDocs-Source": source,
    },
  });
}

/**
 * `POST /api/ask` — answer a question strictly from the user's ready documents.
 *
 * Order of operations: rate limit → validate → require ready documents →
 * answer-cache lookup → retrieval with relevance gate → streamed generation.
 * The gate and the cache hit both return through the same streamed text shape,
 * so the client has a single rendering path. The `X-AskDocs-Source` header
 * reports how the answer was produced.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = requireUser(db);
    enforceRateLimit(db, subjectForUser(user), "ask", {
      limit: config.rateLimitAskPerMinute,
    });

    const { question: rawQuestion } = await parseJsonBody(request, askSchema);
    const question = rawQuestion.trim();
    if (question.length === 0) {
      throw new ValidationError("Ask a question to get an answer.");
    }

    const readyDocumentIds = listReadyDocumentIds(db, user.id);
    if (readyDocumentIds.length === 0) {
      throw new ConflictError(
        "Upload a document before asking a question.",
      );
    }

    const key = answerCacheKey(user.id, question, readyDocumentIds);
    if (config.answerCacheEnabled) {
      const cached = getCachedAnswer(db, key);
      if (cached !== undefined) return textResponse(cached, "cache");
    }

    const retrieval = await retrieveContext(db, user.id, question);
    if (retrieval.gated) {
      return textResponse(NO_CONTEXT_MESSAGE, "no_context");
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let answer = "";
        try {
          for await (const delta of streamAnswer(question, retrieval.chunks)) {
            answer += delta;
            controller.enqueue(encoder.encode(delta));
          }
          if (config.answerCacheEnabled && answer.length > 0) {
            setCachedAnswer(db, { key, userId: user.id, question, answer });
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-AskDocs-Source": "generated",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
