import re
from dataclasses import dataclass

"""Split normalised document text into overlapping chunks, snapping boundaries
to paragraph, sentence, line, or word breaks so chunks stay coherent."""

CHUNK_SIZE = 1200
CHUNK_OVERLAP = 200

_SENTENCE_BOUNDARY = re.compile(r"[.!?][\"')\]]?\s")


@dataclass
class TextChunk:
    """A single chunk of document text."""

    index: int
    content: str


def _find_boundary(text: str, start: int, end: int, overlap: int) -> int:
    """Find the best split point within ``[end - overlap, end]``, preferring a
    paragraph break, then a sentence end, then a line break, then a word break.
    Falls back to ``end`` (a hard cut) if no boundary is found."""
    window_start = max(start + 1, end - overlap)
    window = text[window_start:end]

    paragraph = window.rfind("\n\n")
    if paragraph != -1:
        return window_start + paragraph + 2

    sentence = -1
    for match in _SENTENCE_BOUNDARY.finditer(window):
        sentence = match.end()
    if sentence != -1:
        return window_start + sentence

    newline = window.rfind("\n")
    if newline != -1:
        return window_start + newline + 1

    space = window.rfind(" ")
    if space != -1:
        return window_start + space + 1

    return end


def chunk_text(
    text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP
) -> list[TextChunk]:
    """Split text into ordered, non-empty overlapping chunks. Returns an empty
    list for blank input."""
    overlap = min(overlap, size // 2)
    clean = text.strip()
    if not clean:
        return []
    if len(clean) <= size:
        return [TextChunk(0, clean)]

    chunks: list[TextChunk] = []
    start = 0
    index = 0
    length = len(clean)

    while start < length:
        end = min(start + size, length)
        if end < length:
            end = _find_boundary(clean, start, end, overlap)

        content = clean[start:end].strip()
        if content:
            chunks.append(TextChunk(index, content))
            index += 1

        if end >= length:
            break
        next_start = end - overlap
        start = next_start if next_start > start else end

    return chunks
