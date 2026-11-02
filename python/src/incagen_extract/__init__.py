"""Source-preserving, offline extraction foundation; no model or network calls."""

from .extract import ExtractionError, extract_document, profile_table

__all__ = ["ExtractionError", "extract_document", "profile_table"]
