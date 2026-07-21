import io

import pytest
from docx import Document

from app.services.extraction import (
    ExtractionError,
    extract_document_text,
    normalize_text,
)


def _make_docx(lines: list[str]) -> bytes:
    document = Document()
    for line in lines:
        document.add_paragraph(line)
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def test_normalize_collapses_whitespace_and_blank_lines():
    assert normalize_text("a  \t b\r\n\n\n\nc   ") == "a b\n\nc"


def test_extract_docx_returns_text():
    data = _make_docx(["Hello world.", "The capital of France is Paris."])
    text = extract_document_text("docx", data)
    assert "Hello world." in text
    assert "capital of France" in text


def test_extract_empty_docx_raises():
    data = _make_docx([])
    with pytest.raises(ExtractionError):
        extract_document_text("docx", data)


def test_extract_corrupt_file_raises():
    with pytest.raises(ExtractionError):
        extract_document_text("docx", b"not a real docx")
