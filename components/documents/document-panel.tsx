"use client";

import { UploadDropzone } from "@/components/documents/upload-dropzone";
import { DocumentList } from "@/components/documents/document-list";
import type { DocumentDto } from "@/lib/shared/types";

/**
 * The left panel: upload zone plus the list of uploaded documents.
 *
 * @module components/documents/document-panel
 */
export function DocumentPanel({
  documents,
  maxDocuments,
  uploading,
  deletingId,
  onFiles,
  onDelete,
}: {
  documents: DocumentDto[];
  maxDocuments: number;
  uploading: boolean;
  deletingId: string | null;
  onFiles: (files: File[]) => void;
  onDelete: (id: string) => void;
}) {
  const readyCount = documents.filter((d) => d.status === "ready").length;

  return (
    <aside className="flex h-full w-full flex-col gap-4 border-zinc-200 bg-zinc-50 p-4 md:w-80 md:shrink-0 md:border-r lg:w-96 dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Documents
        </h2>
        <p className="text-xs text-zinc-500">
          {documents.length}/{maxDocuments} uploaded · {readyCount} ready
        </p>
      </div>

      <UploadDropzone
        onFiles={onFiles}
        busy={uploading}
        disabled={documents.length >= maxDocuments}
      />

      <div className="scroll-area -mr-1 flex-1 overflow-y-auto pr-1">
        <DocumentList
          documents={documents}
          onDelete={onDelete}
          deletingId={deletingId}
        />
      </div>
    </aside>
  );
}
