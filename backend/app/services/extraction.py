import io
import re

import docx
from pypdf import PdfReader

"""Document text extraction. PDF via ``pypdf``, DOCX via ``python-docx``.
Output is whitespace-normalised plain text with paragraph breaks preserved."""


class ExtractionError(Exception):
    """Raised when a document cannot be parsed or has no extractable text."""


def normalize_text(text: str) -> str:
    """Unify newlines, collapse intra-line whitespace, and collapse blank-line
    runs to a single paragraph break."""
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_pdf(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def _extract_docx(data: bytes) -> str:
    document = docx.Document(io.BytesIO(data))
    return "\n".join(paragraph.text for paragraph in document.paragraphs)


def extract_document_text(kind: str, data: bytes) -> str:
    """Extract and normalise text from an uploaded document.

    Raises ExtractionError when the file cannot be parsed or contains no
    extractable text (e.g. a scanned, image-only PDF).
    """
    try:
        raw = _extract_pdf(data) if kind == "pdf" else _extract_docx(data)
    except Exception as error:  # noqa: BLE001 - surfaced as a domain error
        raise ExtractionError(
            f"Could not read the {kind.upper()} file: {error}"
        ) from error

    normalized = normalize_text(raw)
    if not normalized:
        raise ExtractionError(
            "The document contains no extractable text. "
            "Scanned or image-only files are not supported."
        )
    return normalized
