import hashlib
import re

from app.config import settings

"""Answer-cache key derivation.

The key is a hash of the normalised question, the sorted set of active
(``ready``) document ids, the generation model, and the prompt version. Because
the active document set is part of the key, adding or removing a document
changes the key and cached answers can never go stale. Persistence lives in the
store; this module only computes keys.
"""


def normalize_question(question: str) -> str:
    """Trim, collapse whitespace, and lowercase a question for cache keying."""
    return re.sub(r"\s+", " ", question.strip()).lower()


def answer_cache_key(user_id: str, question: str, ready_document_ids: list[str]) -> str:
    """Compute the answer-cache key."""
    corpus = ",".join(sorted(ready_document_ids))
    parts = [
        user_id,
        normalize_question(question),
        corpus,
        settings.gemini_model,
        settings.prompt_version,
    ]
    digest = hashlib.sha256()
    for part in parts:
        digest.update(part.encode("utf-8"))
        digest.update(b" ")
    return digest.hexdigest()
