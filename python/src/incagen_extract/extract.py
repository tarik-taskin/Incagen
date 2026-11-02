"""Read modern documents without executing macros, formulas or external resources."""

from __future__ import annotations

import csv
import hashlib
import io
import math
import re
import zipfile
from datetime import date, datetime
from pathlib import Path, PurePosixPath

import pandas as pd
import pdfplumber
from defusedxml import ElementTree
from docx import Document
from docx.oxml.ns import qn
from openpyxl import load_workbook

MAX_BYTES = 25 * 1024 * 1024
MAX_ROWS, MAX_COLUMNS, MAX_CELLS = 50_000, 200, 500_000
MAX_CHARACTERS, CHUNK_CHARACTERS, MAX_CHUNKS = 1_000_000, 12_000, 1000
MIMES = {
    "pdf": "application/pdf", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv", "tsv": "text/tab-separated-values", "txt": "text/plain", "md": "text/markdown",
}


class ExtractionError(ValueError):
    """A bounded, user-safe parsing failure; never contains document text."""


def inspect_office(data: bytes, required: str) -> None:
    """Bound expansion and reject traversal, entities, active parts and external relationships."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            names = {entry.filename for entry in entries}
            if len(entries) > 2000 or sum(entry.file_size for entry in entries) > 40 * 1024 * 1024:
                raise ExtractionError("Office archive exceeds extraction limits.")
            if required not in names or "[Content_Types].xml" not in names or len(names) != len(entries):
                raise ExtractionError("Invalid or duplicate Office archive entries.")
            for entry in entries:
                name = entry.filename
                lower = name.lower()
                if PurePosixPath(name).is_absolute() or ".." in PurePosixPath(name).parts or "\\" in name or entry.flag_bits & 1:
                    raise ExtractionError("Unsafe or encrypted Office archive.")
                if any(part in lower for part in ("vbaproject", "embeddings/", "externallinks/", "activex/")):
                    raise ExtractionError("Active Office content is unsupported.")
                if lower.endswith((".xml", ".rels")):
                    root = ElementTree.fromstring(archive.read(entry))
                    if lower.endswith(".rels") and any(item.get("TargetMode", "").lower() == "external" for item in root):
                        raise ExtractionError("External Office relationships are unsupported.")
    except ExtractionError:
        raise
    except Exception as error:
        raise ExtractionError("Office archive cannot be read.") from error


def primitive(value):
    """Keep source cells as JSON primitives without locale-dependent numeric guessing."""
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ExtractionError("Non-finite numeric cell.")
        return value
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def text_chunks(source_id: str, text: str, locator: dict) -> list[dict]:
    """Split text without losing its page or paragraph anchor."""
    text = text.replace("\x00", "").strip()
    if len(text) > MAX_CHARACTERS:
        raise ExtractionError("Text exceeds extraction limits.")
    return [{"id": f"{source_id}:text:{offset // CHUNK_CHARACTERS + 1:04}", "kind": "text", "text": text[offset:offset + CHUNK_CHARACTERS], "locator": locator}
            for offset in range(0, len(text), CHUNK_CHARACTERS)]


def table_chunks(source_id: str, values: list[list], locator: dict, row_start: int = 2) -> list[dict]:
    """Normalize header labels; preserve physical row ranges including blank rows."""
    if not values:
        return []
    width = max(map(len, values))
    if not 0 < width <= MAX_COLUMNS or len(values) - 1 > MAX_ROWS or (len(values) - 1) * width > MAX_CELLS:
        raise ExtractionError("Table exceeds extraction limits.")
    columns, seen = [], set()
    for index in range(width):
        label = str(values[0][index] if index < len(values[0]) and values[0][index] is not None else "").strip() or f"Column {index + 1}"
        candidate, suffix = label, 2
        while candidate in seen:
            candidate, suffix = f"{label} ({suffix})", suffix + 1
        columns.append(candidate)
        seen.add(candidate)
    rows = [[primitive(row[index]) if index < len(row) else None for index in range(width)] for row in values[1:]]
    return [{"id": f"{source_id}:table:{start // 250 + 1:04}", "kind": "table",
             "locator": {**locator, "rowStart": row_start + start, "rowEnd": row_start + start + len(rows[start:start + 250]) - 1},
             "table": {"columns": columns, "rows": rows[start:start + 250]}} for start in range(0, len(rows), 250)]


def extract_document(path: str | Path, source_id: str = "file-0") -> dict:
    """Extract bounded source content into Incagen's existing version-1 document contract."""
    path = Path(path)
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", source_id) or len(path.name) > 200:
        raise ExtractionError("Invalid source identity.")
    extension = path.suffix.lower().lstrip(".")
    if extension not in MIMES or path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= MAX_BYTES:
        raise ExtractionError("Unsupported, empty or oversized document.")
    with path.open("rb") as source:
        data = source.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ExtractionError("Document exceeds extraction limits.")
    chunks, warnings, metadata = [], [], {}
    try:
        if extension in ("csv", "tsv"):
            text = data.decode("utf-8-sig", errors="strict")
            delimiter = "\t" if extension == "tsv" else csv.Sniffer().sniff(text[:8192], delimiters=",;\t").delimiter
            values = []
            for row in csv.reader(io.StringIO(text), delimiter=delimiter, strict=True):
                if len(values) > MAX_ROWS or len(row) > MAX_COLUMNS or (len(values) + 1) * max(1, len(row)) > MAX_CELLS + MAX_COLUMNS:
                    raise ExtractionError("Table exceeds extraction limits.")
                values.append(row)
            if values and any(len(row) != len(values[0]) for row in values):
                raise ExtractionError("Inconsistent table row width.")
            chunks = table_chunks(source_id, values, {"section": "table"})
        elif extension in ("txt", "md"):
            chunks = text_chunks(source_id, data.decode("utf-8-sig", errors="strict"), {"section": "document"})
        elif extension == "xlsx":
            inspect_office(data, "xl/workbook.xml")
            book = load_workbook(io.BytesIO(data), read_only=True, data_only=False, keep_links=False)
            try:
                if len(book.worksheets) > 50:
                    raise ExtractionError("Workbook exceeds sheet limit.")
                metadata["sheets"] = len(book.worksheets)
                for number, sheet in enumerate(book.worksheets, 1):
                    if sheet.max_row > MAX_ROWS + 1 or sheet.max_column > MAX_COLUMNS:
                        raise ExtractionError("Worksheet exceeds extraction limits.")
                    rows = []
                    for row in sheet.iter_rows():
                        values = []
                        for cell in row:
                            if cell.data_type == "f":
                                if "Excel formulas are not evaluated; formula cells are null." not in warnings:
                                    warnings.append("Excel formulas are not evaluated; formula cells are null.")
                                values.append(None)
                            else:
                                values.append(primitive(cell.value))
                        rows.append(values)
                    chunks.extend(table_chunks(f"{source_id}:sheet-{number}", rows, {"sheet": sheet.title}))
            finally:
                book.close()
        elif extension == "docx":
            inspect_office(data, "word/document.xml")
            document = Document(io.BytesIO(data))
            for index, block in enumerate(document.element.body, 1):
                if block.tag == qn("w:p"):
                    text = "".join(node.text or "" for node in block.iter(qn("w:t")))
                    chunks.extend(text_chunks(f"{source_id}:block-{index}", text, {"section": f"block-{index}"}))
                elif block.tag == qn("w:tbl"):
                    rows = [[" ".join(node.text or "" for node in cell.iter(qn("w:t"))) for cell in row.findall(qn("w:tc"))] for row in block.findall(qn("w:tr"))]
                    chunks.extend(table_chunks(f"{source_id}:block-{index}", rows, {"section": f"block-{index}"}))
        else:
            if not data.startswith(b"%PDF-"):
                raise ExtractionError("Invalid PDF signature.")
            with pdfplumber.open(io.BytesIO(data), unicode_norm="NFC") as pdf:
                if not 0 < len(pdf.pages) <= 250:
                    raise ExtractionError("PDF exceeds page limit.")
                metadata["pages"] = len(pdf.pages)
                for number, page in enumerate(pdf.pages, 1):
                    page_text = page.extract_text() or ""
                    chunks.extend(text_chunks(f"{source_id}:page-{number}", page_text, {"page": number}))
                    for table_number, table in enumerate(page.extract_tables(), 1):
                        chunks.extend(table_chunks(f"{source_id}:page-{number}:table-{table_number}", table, {"page": number}))
                    if not page_text.strip():
                        warnings.append(f"Page {number}: no text layer; OCR is not enabled.")
                        chunks.append({"id": f"{source_id}:page-{number}:image", "kind": "image", "locator": {"page": number}})
            if any(chunk["kind"] == "table" for chunk in chunks):
                warnings.append("PDF text and table views may overlap; do not count them as separate records.")
    except ExtractionError:
        raise
    except Exception as error:
        raise ExtractionError("Document is malformed, encrypted or unreadable.") from error
    characters = sum(len(chunk.get("text", "")) + sum(len(str(cell)) for row in chunk.get("table", {}).get("rows", []) for cell in row if cell is not None) for chunk in chunks)
    rows = sum(len(chunk.get("table", {}).get("rows", [])) for chunk in chunks)
    cells = sum(len(row) for chunk in chunks for row in chunk.get("table", {}).get("rows", []))
    if not chunks or len(chunks) > MAX_CHUNKS or characters > MAX_CHARACTERS or rows > MAX_ROWS or cells > MAX_CELLS:
        raise ExtractionError("Document is empty or exceeds total extraction limits.")
    return {"version": 1, "sourceId": source_id, "fileName": path.name, "sha256": hashlib.sha256(data).hexdigest(),
            "extension": extension, "detectedMime": MIMES[extension], "category": "Tablo" if extension in ("csv", "tsv", "xlsx") else "Belge",
            "parserVersion": "incagen-python/0.1.0", "metadata": metadata, "chunks": chunks, "warnings": warnings}


def profile_table(chunk: dict) -> dict:
    """Use pandas for explicit completeness counts; never infer currency, totals or sentiment."""
    if chunk.get("kind") != "table":
        raise ExtractionError("A table chunk is required.")
    frame = pd.DataFrame(chunk["table"]["rows"], columns=chunk["table"]["columns"]).replace("", None)
    return {"rows": len(frame), "columns": len(frame.columns), "missingByColumn": {str(key): int(value) for key, value in frame.isna().sum().items()}}
