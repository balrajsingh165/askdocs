"use client";

import { Spinner } from "@/components/ui/spinner";
import { AlertIcon, CheckIcon, FileIcon, TrashIcon } from "@/components/ui/icons";
import { formatBytes } from "@/lib/shared/format";
import type { DocumentDto, DocumentStatus } from "@/lib/shared/types";

/**
 * The list of uploaded documents with per-document status and a delete action.
 *
 * @module components/documents/document-list
 */

function StatusBadge({ status, error }: { status: DocumentStatus; error: string | null }) {
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        <Spinner className="text-[0.85em]" /> Processing
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        title={error ?? undefined}
        className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
      >
        <AlertIcon /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
      <CheckIcon /> Ready
    </span>
  );
}

export function DocumentList({
  documents,
  onDelete,
  deletingId,
}: {
  documents: DocumentDto[];
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  if (documents.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-zinc-500">
        No documents yet. Upload one to start asking questions.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <span className="mt-0.5 text-lg text-indigo-500">
            <FileIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={doc.filename}>
              {doc.filename}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {doc.kind.toUpperCase()} · {formatBytes(doc.sizeBytes)}
              {doc.status === "ready" ? ` · ${doc.chunkCount} chunks` : ""}
            </p>
            {doc.status === "failed" && doc.error ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {doc.error}
              </p>
            ) : null}
            <div className="mt-2">
              <StatusBadge status={doc.status} error={doc.error} />
            </div>
          </div>
          <button
            type="button"
            aria-label={`Delete ${doc.filename}`}
            onClick={() => onDelete(doc.id)}
            disabled={deletingId === doc.id}
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950"
          >
            {deletingId === doc.id ? <Spinner /> : <TrashIcon />}
          </button>
        </li>
      ))}
    </ul>
  );
}
