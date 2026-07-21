"use client";

import { MessageList } from "@/components/chat/message-list";
import { Composer } from "@/components/chat/composer";
import { SparkleIcon } from "@/components/ui/icons";
import type { ChatMessage } from "@/lib/shared/types";

/**
 * The main chat column: an empty state until the first question, then the
 * message list, with the composer pinned to the bottom.
 *
 * @module components/chat/chat-panel
 */
export function ChatPanel({
  messages,
  busy,
  hasReadyDocuments,
  onAsk,
}: {
  messages: ChatMessage[];
  busy: boolean;
  hasReadyDocuments: boolean;
  onAsk: (question: string) => void;
}) {
  return (
    <section className="flex h-full min-w-0 flex-1 flex-col">
      {messages.length === 0 ? (
        <EmptyState hasReadyDocuments={hasReadyDocuments} />
      ) : (
        <MessageList messages={messages} />
      )}
      <Composer
        onSubmit={onAsk}
        busy={busy}
        disabled={!hasReadyDocuments}
        placeholder={
          hasReadyDocuments
            ? "Ask a question about your documents…"
            : "Upload a document to start asking questions"
        }
      />
    </section>
  );
}

function EmptyState({ hasReadyDocuments }: { hasReadyDocuments: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-indigo-100 text-2xl text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
        <SparkleIcon />
      </span>
      <h2 className="text-lg font-semibold">Ask your documents anything</h2>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">
        {hasReadyDocuments
          ? "Answers are drawn strictly from your uploaded documents. If the answer isn't in them, AskDocs will say so."
          : "Upload a PDF or DOCX on the left, then ask a question here."}
      </p>
    </div>
  );
}
