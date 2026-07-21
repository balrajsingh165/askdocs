"use client";

import { useEffect, useRef } from "react";
import { AlertIcon, SparkleIcon } from "@/components/ui/icons";
import type { ChatMessage } from "@/lib/shared/types";

/**
 * The scrolling list of chat messages. User messages are right-aligned
 * bubbles; assistant messages are left-aligned. Out-of-context answers get a
 * distinct amber treatment so refusals read clearly.
 *
 * @module components/chat/message-list
 */

function AssistantBubble({ message }: { message: ChatMessage }) {
  const isNoContext = message.source === "no_context";
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-1 flex size-7 shrink-0 items-center justify-center rounded-full text-sm ${
          isNoContext
            ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300"
            : "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
        }`}
      >
        {isNoContext ? <AlertIcon /> : <SparkleIcon />}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={`inline-block max-w-full whitespace-pre-wrap rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed ${
            isNoContext
              ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
              : "bg-white text-zinc-800 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
          } ${message.pending ? "streaming-caret" : ""}`}
        >
          {message.content}
        </div>
        {message.source === "cache" && !message.pending ? (
          <p className="mt-1 pl-1 text-xs text-zinc-400">Served from cache</p>
        ) : null}
      </div>
    </div>
  );
}

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="scroll-area flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-sm leading-relaxed text-white">
                {message.content}
              </div>
            </div>
          ) : (
            <AssistantBubble key={message.id} message={message} />
          ),
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
