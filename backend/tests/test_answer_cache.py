from app.answer_cache import answer_cache_key, normalize_question


def test_normalize_question_collapses_and_lowercases():
    assert normalize_question("  What   is  X? ") == "what is x?"


def test_key_is_stable_regardless_of_document_order():
    a = answer_cache_key("u1", "What is X?", ["b", "a", "c"])
    b = answer_cache_key("u1", "What is X?", ["a", "b", "c"])
    assert a == b


def test_key_normalises_question():
    a = answer_cache_key("u1", "  What   is X? ", ["a"])
    b = answer_cache_key("u1", "what is x?", ["a"])
    assert a == b


def test_key_changes_with_document_set():
    a = answer_cache_key("u1", "What is X?", ["a"])
    b = answer_cache_key("u1", "What is X?", ["a", "b"])
    assert a != b


def test_key_is_scoped_per_user():
    assert answer_cache_key("u1", "q", ["a"]) != answer_cache_key("u2", "q", ["a"])
