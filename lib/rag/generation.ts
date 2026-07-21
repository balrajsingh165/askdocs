import { GoogleGenAI } from "@google/genai";
import { config } from "@/lib/config";
import { GenerationError } from "@/lib/errors";
import { buildUserMessage, SYSTEM_PROMPT } from "@/lib/rag/prompt";
import type { RetrievedChunk } from "@/lib/rag/retrieval";

/**
 * Gemini answer generation. This is the ONLY module that imports the Google
 * Gen AI SDK. Answers are streamed so the UI renders tokens as they arrive.
 *
 * Grounding rules are supplied via the system instruction; the retrieved
 * chunks and question are supplied as the user content. Temperature is 0 for
 * faithful, deterministic grounding, and model thinking is disabled to keep
 * short factual answers fast.
 *
 * @module lib/rag/generation
 */

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!config.geminiApiKey) {
    throw new GenerationError(
      "GEMINI_API_KEY is not configured. Set it in .env.local (or .env).",
    );
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return client;
}

/**
 * Stream a grounded answer for a question and its retrieved context.
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
  const ai = getClient();
  try {
    const stream = await ai.models.generateContentStream({
      model: config.geminiModel,
      contents: buildUserMessage(question, chunks),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: config.geminiMaxTokens,
        temperature: 0,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield text;
    }
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new GenerationError(`Answer generation failed: ${detail}`);
  }
}
