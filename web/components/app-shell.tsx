"use client";

import { useCallback, useEffect, useState } from "react";
import { DocumentPanel } from "@/components/documents/document-panel";
import { ChatPanel } from "@/components/chat/chat-panel";
import { AlertIcon } from "@/components/ui/icons";
import {
  askQuestion,
  deleteDocument,
  fetchDocuments,
  uploadDocument,
} from "@/lib/shared/api";
import type { ChatMessage, DocumentDto } from "@/lib/shared/types";

/**
 * Top-level client shell. Owns document and chat state and orchestrates all
 * API calls. Rendered by the server page, which supplies `maxDocuments`.
 *
 * @module components/app-shell
 */
export function AppShell({ maxDocuments }: { maxDocuments: number }) {
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments()
      .then(setDocuments)
      .catch((cause: unknown) => setError(errorMessage(cause)));
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  const hasProcessing = documents.some((doc) => doc.status === "processing");
  useEffect(() => {
    if (!hasProcessing) return;
    const interval = setInterval(() => {
      fetchDocuments()
        .then(setDocuments)
        .catch(() => {
          /* transient poll failure — keep the last known state */
        });
    }, 1500);
    return () => clearInterval(interval);
  }, [hasProcessing]);

  const handleFiles = useCallback(async (files: File[]) => {
    setUploading(true);
    try {
      for (const file of files) {
        const created = await uploadDocument(file);
        setDocuments((prev) => [
          created,
          ...prev.filter((doc) => doc.id !== created.id),
        ]);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleAsk = useCallback(async (question: string) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", content: "", pending: true },
    ]);
    setAsking(true);

    try {
      const { source } = await askQuestion(question, (delta) => {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: message.content + delta }
              : message,
          ),
        );
      });
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? { ...message, pending: false, source }
            : message,
        ),
      );
    } catch (cause) {
      setMessages((prev) => prev.filter((message) => message.id !== assistantId));
      setError(errorMessage(cause));
    } finally {
      setAsking(false);
    }
  }, []);

  const hasReadyDocuments = documents.some((doc) => doc.status === "ready");

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            A
          </span>
          <div>
            <h1 className="text-sm font-semibold leading-tight">AskDocs</h1>
            <p className="text-xs text-zinc-500">
              Answers grounded in your documents
            </p>
          </div>
        </div>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800">
          Developer mode
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="max-h-[45vh] md:max-h-none md:h-full">
          <DocumentPanel
            documents={documents}
            maxDocuments={maxDocuments}
            uploading={uploading}
            deletingId={deletingId}
            onFiles={handleFiles}
            onDelete={handleDelete}
          />
        </div>
        <ChatPanel
          messages={messages}
          busy={asking}
          hasReadyDocuments={hasReadyDocuments}
          onAsk={handleAsk}
        />
      </div>

      {error ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm text-white shadow-lg">
            <AlertIcon />
            <span>{error}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Something went wrong.";
}
