"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { SendIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";

/**
 * The question input. Enter submits, Shift+Enter inserts a newline. Disabled
 * while a previous answer is streaming or when no documents are ready.
 *
 * @module components/chat/composer
 */
export function Composer({
  onSubmit,
  busy,
  disabled,
  placeholder,
}: {
  onSubmit: (question: string) => void;
  busy: boolean;
  disabled: boolean;
  placeholder: string;
}) {
  const [value, setValue] = useState("");
  const canSend = value.trim().length > 0 && !busy && !disabled;

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;
    onSubmit(value.trim());
    setValue("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={submit}
      className="border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-zinc-300 bg-white p-2 shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:ring-indigo-900">
        <textarea
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="scroll-area max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send question"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-base text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
        >
          {busy ? <Spinner /> : <SendIcon />}
        </button>
      </div>
    </form>
  );
}
