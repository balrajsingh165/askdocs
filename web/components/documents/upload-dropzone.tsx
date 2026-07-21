"use client";

import { useRef, useState, type DragEvent } from "react";
import { Spinner } from "@/components/ui/spinner";
import { UploadIcon } from "@/components/ui/icons";

/**
 * Drag-and-drop / click-to-browse upload zone. Accepts PDF and DOCX files and
 * forwards each selected file to `onFiles`.
 *
 * @module components/documents/upload-dropzone
 */
export function UploadDropzone({
  onFiles,
  busy,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  busy: boolean;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled || busy) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }

  const interactive = !disabled && !busy;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={!interactive}
      onClick={() => interactive && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (interactive && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (interactive) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
        dragging
          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
          : "border-zinc-300 dark:border-zinc-700"
      } ${
        interactive
          ? "cursor-pointer hover:border-indigo-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          : "cursor-not-allowed opacity-60"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
      <span className="text-2xl text-indigo-500">
        {busy ? <Spinner /> : <UploadIcon />}
      </span>
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
        {busy
          ? "Processing…"
          : disabled
            ? "Document limit reached"
            : "Drop a PDF or DOCX, or click to browse"}
      </span>
      <span className="text-xs text-zinc-500">
        Text is extracted, chunked, and embedded locally.
      </span>
    </div>
  );
}
