from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

"""API request/response models. Responses serialise to camelCase to match the
Next.js frontend; inputs accept snake_case field names too."""


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class DocumentOut(CamelModel):
    id: str
    filename: str
    kind: str
    mime_type: str
    size_bytes: int
    status: str
    error: str | None = None
    chunk_count: int
    created_at: int


class DocumentResponse(CamelModel):
    document: DocumentOut


class DocumentListResponse(CamelModel):
    documents: list[DocumentOut]


class AskRequest(BaseModel):
    question: str


class OkResponse(BaseModel):
    ok: bool
