import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MAX_TOKENS, CLAUDE_MODEL, config } from "@/lib/config";
import { GenerationError } from "@/lib/errors";
import { buildUserMessage, SYSTEM_PROMPT } from "@/lib/rag/prompt";
import type { RetrievedChunk } from "@/lib/rag/retrieval";

/**
 * Claude answer generation. This is the ONLY module that imports the Anthropic
 * SDK. Answers are streamed so the UI renders tokens as they arrive.
 *
 * @module lib/rag/generation
 */

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!config.anthropicApiKey) {
    throw new GenerationError(
      "ANTHROPIC_API_KEY is not configured. Set it in .env.local.",
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

/**
 * Stream a grounded answer for a question and its retrieved context.
 *
 * Grounding rules are supplied via the system prompt; the retrieved chunks and
 * question are supplied via the user message. Uses adaptive thinking and no
 * sampling parameters (rejected by this model).
 *
 * @param question - The user's question.
 * @param chunks - Retrieved context chunks.
 * @yields Answer text fragments as they arrive.
 * @throws {GenerationError} When the API key is missing or the request fails.
 */
export async function* streamAnswer(
  question: string,
  chunks: RetrievedChunk[],
): AsyncGenerator<string> {
  const anthropic = getClient();
  try {
    const stream = anthropic.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(question, chunks) }],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new GenerationError(`Answer generation failed: ${detail}`);
  }
}
