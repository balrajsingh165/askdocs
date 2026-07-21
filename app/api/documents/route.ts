import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { requireUser, subjectForUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import {
  countDocuments,
  listDocuments,
} from "@/lib/db/repositories/documents";
import {
  processUpload,
  serializeDocument,
  validateUpload,
} from "@/lib/documents/service";
import { ConflictError, ValidationError } from "@/lib/errors";
import { errorResponse } from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit/limiter";

export const runtime = "nodejs";

/**
 * `GET /api/documents` — list the current user's documents, newest first.
 */
export function GET(): NextResponse {
  try {
    const user = requireUser(db);
    const documents = listDocuments(db, user.id).map(serializeDocument);
    return NextResponse.json({ documents });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * `POST /api/documents` — upload and process a PDF or DOCX document. Returns
 * the resulting document (status `ready` or `failed`).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = requireUser(db);
    enforceRateLimit(db, subjectForUser(user), "documents", {
      limit: config.rateLimitDocumentsPerMinute,
    });

    if (countDocuments(db, user.id) >= config.maxDocuments) {
      throw new ConflictError(
        `Maximum of ${config.maxDocuments} documents reached. Delete one before uploading more.`,
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ValidationError("Expected a multipart form upload.");
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError("Missing 'file' field in the upload.");
    }

    const upload = await validateUpload(file);
    const document = await processUpload(db, user.id, upload);
    return NextResponse.json(
      { document: serializeDocument(document) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
