from app.services.chunking import chunk_text


def test_blank_input_returns_empty():
    assert chunk_text("") == []
    assert chunk_text("   \n  ") == []


def test_short_text_is_a_single_chunk():
    chunks = chunk_text("A short document.", size=100, overlap=20)
    assert len(chunks) == 1
    assert chunks[0].index == 0
    assert chunks[0].content == "A short document."


def test_long_text_splits_into_indexed_chunks():
    text = ("word " * 400).strip()
    chunks = chunk_text(text, size=200, overlap=40)
    assert len(chunks) > 1
    for i, chunk in enumerate(chunks):
        assert chunk.index == i
        assert 0 < len(chunk.content) <= 200


def test_prefers_paragraph_boundary():
    para_a = ("Alpha " * 30).strip()
    para_b = ("Beta " * 30).strip()
    chunks = chunk_text(f"{para_a}\n\n{para_b}", size=len(para_a) + 10, overlap=20)
    assert chunks[0].content == para_a


def test_covers_whole_document():
    text = ("The quick brown fox. " * 60).strip()
    chunks = chunk_text(text, size=150, overlap=30)
    assert chunks[-1].content.endswith("fox.")


def test_overlap_capped_to_guarantee_progress():
    chunks = chunk_text("x" * 1000, size=100, overlap=500)
    assert len(chunks) > 1
