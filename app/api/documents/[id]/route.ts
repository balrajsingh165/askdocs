import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { requireUser, subjectForUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { deleteDocument } from "@/lib/db/repositories/documents";
import { NotFoundError } from "@/lib/errors";
import { errorResponse } from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit/limiter";

export const runtime = "nodejs";

/**
 * `DELETE /api/documents/[id]` — delete a document and its chunks. Cached
 * answers that depended on it become unreachable because the corpus (and thus
 * the answer-cache key) changes.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/documents/[id]">,
): Promise<NextResponse> {
  try {
    const user = requireUser(db);
    enforceRateLimit(db, subjectForUser(user), "documents", {
      limit: config.rateLimitDocumentsPerMinute,
    });

    const { id } = await context.params;
    const deleted = deleteDocument(db, user.id, id);
    if (!deleted) {
      throw new NotFoundError("Document not found.");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
