"""The shape of what the extraction service sends. Shared by the HTTP API and the MCP server."""

from typing import Literal

from pydantic import BaseModel, Field


class SourceIn(BaseModel):
    documentId: str = Field(description="Id of the document the value was read from.")
    page: int | None = Field(default=None, ge=1, description="Page number, starting at 1.")
    clause: str | None = Field(default=None, description='Clause reference as printed, for example "cl. 24".')


class ExtractedFieldIn(BaseModel):
    id: str = Field(description="Field id, from the field definitions.")
    value: str | None = Field(default=None, description="The extracted value, or null if nothing was found.")
    confidence: Literal["high", "medium", "low"] | None = None
    source: SourceIn | None = None


class ExtractionIn(BaseModel):
    fields: list[ExtractedFieldIn]


class EditIn(BaseModel):
    value: str | None = None
    notInDocuments: bool = False


class EventIn(BaseModel):
    event: Literal["deal-opened", "document-viewed", "field-viewed"]
    fieldId: str | None = None
    documentId: str | None = None


class FieldCreateIn(BaseModel):
    label: str
    group: str
    id: str | None = Field(default=None, description="Optional. Made from the label when left out. Cannot be changed later.")


class FieldUpdateIn(BaseModel):
    label: str | None = None
    group: str | None = None
    active: bool | None = Field(default=None, description="False retires the field. True restores it.")
