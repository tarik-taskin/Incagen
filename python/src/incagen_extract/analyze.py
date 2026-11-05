"""Explicit, decimal-based calculations for one user-selected source table."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_EVEN, localcontext
import re

from .extract import ExtractionError

FORMATS = {
    "plain": re.compile(r"^[+-]?\d+(?:\.\d+)?$"),
    "en": re.compile(r"^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$"),
    "tr": re.compile(r"^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$"),
}
UNITS = {"number", "count", "TRY", "USD", "EUR", "percent"}
MAX_ANALYSIS_ROWS, MAX_GROUPS = 5000, 12


class CalculationError(ExtractionError):
    """A stable failure code without source values or private document text."""


def decimal_cell(value, number_format: str, unit: str) -> Decimal:
    """Parse an explicitly selected number format; never guess currency or missing values."""
    if isinstance(value, bool) or value is None or value == "":
        raise CalculationError("invalid-measure")
    if isinstance(value, (int, float)):
        text = str(value)
    elif isinstance(value, str) and len(value) <= 100:
        text = value.strip()
        if not FORMATS[number_format].fullmatch(text):
            raise CalculationError("invalid-number-format")
        if number_format == "tr":
            text = text.replace(".", "").replace(",", ".")
        elif number_format == "en":
            text = text.replace(",", "")
    else:
        raise CalculationError("invalid-measure")
    try:
        number = Decimal(text)
    except InvalidOperation as error:
        raise CalculationError("invalid-measure") from error
    if not number.is_finite() or abs(number) > Decimal("1000000000000"):
        raise CalculationError("number-out-of-range")
    if unit in {"TRY", "USD", "EUR"} and number != number.quantize(Decimal("0.01")):
        raise CalculationError("currency-precision")
    return number


def evidence_for(document: dict, rows: list[tuple[dict, int, list]]) -> list[dict]:
    """Merge only adjacent physical rows in the same source chunk into exact evidence ranges."""
    evidence = []
    for chunk, physical_row, _ in rows:
        locator = {**chunk["locator"], "rowStart": physical_row, "rowEnd": physical_row}
        if evidence and evidence[-1]["chunkId"] == chunk["id"] and evidence[-1]["locator"]["rowEnd"] + 1 == physical_row:
            evidence[-1]["locator"]["rowEnd"] = physical_row
        else:
            evidence.append({"sourceId": document["sourceId"], "sha256": document["sha256"], "chunkId": chunk["id"], "locator": locator})
    if not evidence or len(evidence) > 256:
        raise CalculationError("evidence-limit")
    return evidence


def analyze_table(document: dict, selection: dict) -> dict:
    """Calculate one explicit measure without double-counting other sheets or documents."""
    fields = {"sheet", "valueColumn", "groupColumn", "aggregation", "numberFormat", "unit"}
    if not isinstance(selection, dict) or set(selection) != fields:
        raise CalculationError("invalid-selection")
    sheet, value_column, group_column = selection["sheet"], selection["valueColumn"], selection["groupColumn"]
    aggregation, number_format, unit = selection["aggregation"], selection["numberFormat"], selection["unit"]
    if aggregation not in {"sum", "mean", "count"} or number_format not in FORMATS or unit not in UNITS:
        raise CalculationError("invalid-selection")
    if (aggregation == "count" and (value_column is not None or unit != "count")) or (aggregation != "count" and (type(value_column) is not int or unit == "count")):
        raise CalculationError("invalid-selection")
    if group_column is not None and type(group_column) is not int:
        raise CalculationError("invalid-selection")
    if document.get("extension") not in {"csv", "xlsx"} or (sheet is not None and (not isinstance(sheet, str) or not 0 < len(sheet) <= 200)):
        raise CalculationError("unsupported-table")
    chunks = [chunk for chunk in document["chunks"] if chunk.get("kind") == "table" and chunk["locator"].get("sheet") == sheet]
    if not chunks:
        raise CalculationError("table-not-found")
    columns = chunks[0]["table"]["columns"]
    if any(chunk["table"]["columns"] != columns for chunk in chunks):
        raise CalculationError("inconsistent-columns")
    if any(index is not None and not 0 <= index < len(columns) for index in (value_column, group_column)) or value_column == group_column and value_column is not None:
        raise CalculationError("invalid-selection")
    all_rows = [(chunk, chunk["locator"]["rowStart"] + offset, row) for chunk in chunks for offset, row in enumerate(chunk["table"]["rows"])]
    if not 0 < len(all_rows) <= MAX_ANALYSIS_ROWS:
        raise CalculationError("analysis-row-limit")
    rows = [entry for entry in all_rows if any(cell is not None and str(cell).strip() != "" for cell in entry[2])]
    if not rows:
        raise CalculationError("empty-table")
    groups: dict[str, list] = {}
    for entry in rows:
        if group_column is None:
            continue
        value = entry[2][group_column]
        if value is None or isinstance(value, bool) or not str(value).strip() or len(str(value)) > 200 or str(value) != str(value).strip():
            raise CalculationError("invalid-group")
        label = str(value)
        groups.setdefault(label, []).append(entry)
        if len(groups) > MAX_GROUPS:
            raise CalculationError("group-limit")

    def calculate(entries):
        """Round only the final explicit aggregation; source decimals remain unchanged."""
        if aggregation == "count":
            return len(entries)
        with localcontext() as context:
            context.prec = 38
            total = sum((decimal_cell(entry[2][value_column], number_format, unit) for entry in entries), Decimal(0))
            value = total / len(entries) if aggregation == "mean" else total
            precision = Decimal("0.01") if unit in {"TRY", "USD", "EUR"} else Decimal("0.000001")
            rounded = value.quantize(precision, rounding=ROUND_HALF_EVEN)
            if abs(rounded) > Decimal("9000000000000"):
                raise CalculationError("number-out-of-range")
            result = float(rounded)
            if Decimal(str(result)) != rounded:
                raise CalculationError("number-precision")
            return result

    metrics = [
        {"id": "rows", "labelKey": "rows", "value": len(rows), "unit": "count", "methodKey": "count", "evidence": evidence_for(document, rows)},
        {"id": "aggregate", "labelKey": aggregation, "value": calculate(rows), "unit": unit, "methodKey": aggregation, "evidence": evidence_for(document, rows)},
    ]
    points = []
    for index, (label, entries) in enumerate(groups.items()):
        metric_id = f"group-{index + 1}"
        metrics.append({"id": metric_id, "label": label, "value": calculate(entries), "unit": unit, "methodKey": aggregation, "evidence": evidence_for(document, entries)})
        points.append({"label": label, "metricId": metric_id, "value": metrics[-1]["value"]})
    points.sort(key=lambda point: (-point["value"], point["label"]))
    selected_document = {**document, "chunks": chunks}
    return {"version": 1, "document": selected_document, "metrics": metrics, "points": points,
            "scope": {"rows": len(rows), "emptyRows": len(all_rows) - len(rows), "groups": len(groups), "sheet": sheet,
                      "measure": columns[value_column] if value_column is not None else None,
                      "group": columns[group_column] if group_column is not None else None, "selection": selection}}
