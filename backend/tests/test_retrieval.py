from app.services.retrieval import apply_gate


def _payload(name: str):
    return {"document_id": name, "document_name": f"{name}.pdf", "content": f"content {name}"}


def test_gate_fires_when_nothing_clears_threshold():
    gated, chunks = apply_gate(
        [(0.40, _payload("a")), (0.31, _payload("b"))], threshold=0.5
    )
    assert gated is True
    assert chunks == []


def test_gate_passes_and_preserves_order():
    hits = [(0.90, _payload("high")), (0.70, _payload("mid")), (0.55, _payload("low"))]
    gated, chunks = apply_gate(hits, threshold=0.5)
    assert gated is False
    assert [c.document_id for c in chunks] == ["high", "mid", "low"]


def test_gate_filters_below_threshold():
    hits = [(0.90, _payload("keep")), (0.20, _payload("drop"))]
    gated, chunks = apply_gate(hits, threshold=0.5)
    assert [c.document_id for c in chunks] == ["keep"]


def test_gate_on_empty_hits():
    gated, chunks = apply_gate([], threshold=0.5)
    assert gated is True and chunks == []
