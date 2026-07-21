from collections.abc import Iterable, Iterator
from functools import lru_cache

from google import genai
from google.genai import types

from app.config import settings
from app.grounding import SYSTEM_PROMPT, build_user_message
from app.services.retrieval import RetrievedChunk

"""Gemini answer generation. The only module that streams from the generation
model. Grounding rules go in the system instruction; retrieved chunks and the
question go in the contents. Temperature 0 and thinking disabled keep grounded
answers faithful and fast."""


class GenerationError(Exception):
    """Raised when generation fails (e.g. missing API key or upstream error)."""


@lru_cache(maxsize=1)
def _client() -> genai.Client:
    key = settings.resolved_gemini_key
    if not key:
        raise GenerationError("GEMINI_API_KEY is not configured. Set it in .env.")
    return genai.Client(api_key=key)


def stream_answer(
    question: str, chunks: Iterable[RetrievedChunk]
) -> Iterator[str]:
    """Stream a grounded answer for a question and its retrieved context."""
    client = _client()
    try:
        stream = client.models.generate_content_stream(
            model=settings.gemini_model,
            contents=build_user_message(question, chunks),
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                max_output_tokens=settings.gemini_max_tokens,
                temperature=0,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        for chunk in stream:
            if chunk.text:
                yield chunk.text
    except GenerationError:
        raise
    except Exception as error:  # noqa: BLE001 - surfaced as a domain error
        raise GenerationError(f"Answer generation failed: {error}") from error
