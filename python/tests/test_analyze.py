"""Independent answers for decimal, source and scope acceptance."""

import pytest

from incagen_extract.analyze import CalculationError, analyze_table
from incagen_extract.extract import extract_document


def selection(**changes):
    """Use an explicit Turkish monetary measure, never header-based guessing."""
    return {"sheet": None, "valueColumn": 1, "groupColumn": 0, "aggregation": "sum", "numberFormat": "tr", "unit": "TRY", **changes}


def document(tmp_path, text):
    """Build a source through the real CSV extractor."""
    path = tmp_path / "sales.csv"
    path.write_text(text, encoding="utf8")
    return extract_document(path)


def test_decimal_refunds_and_exact_group_evidence(tmp_path):
    data = document(tmp_path, 'Kanal;Tutar\nWeb;1.234,56\nMağaza;200,00\nWeb;-34,56\nMağaza;0,00\n')
    result = analyze_table(data, selection())
    assert result["metrics"][1]["value"] == 1400
    assert result["points"] == [{"label": "Web", "metricId": "group-1", "value": 1200}, {"label": "Mağaza", "metricId": "group-2", "value": 200}]
    assert [anchor["locator"] for anchor in result["metrics"][2]["evidence"]] == [
        {"section": "table", "rowStart": 2, "rowEnd": 2}, {"section": "table", "rowStart": 4, "rowEnd": 4}]


def test_mean_is_weighted_from_rows_not_group_means(tmp_path):
    data = document(tmp_path, 'Group,Value\nA,10\nA,20\nB,90\n')
    result = analyze_table(data, selection(aggregation="mean", numberFormat="en", unit="number"))
    assert result["metrics"][1]["value"] == 40
    assert [point["value"] for point in result["points"]] == [90, 15]


@pytest.mark.parametrize("text,changes", [
    ('G;V\nA;\n', {}), ('G;V\nA;abc\n', {}), ('G;V\nA;1,23\n', {"numberFormat": "en"}),
    ('G;V\nA;1,234\n', {}), ('G;V\n;10\n', {}), ('G;V\nA;NaN\n', {"numberFormat": "plain"}),
    ('G;V\nA;10\n', {"valueColumn": True}), ('G;V\nA;10\n', {"groupColumn": 3}),
])
def test_missing_ambiguous_invalid_and_out_of_range_selection_fail(tmp_path, text, changes):
    with pytest.raises(CalculationError):
        analyze_table(document(tmp_path, text), selection(**changes))


def test_count_ignores_only_fully_blank_physical_rows(tmp_path):
    result = analyze_table(document(tmp_path, 'G;V\nA;10\n;\nB;20\n'), selection(valueColumn=None, groupColumn=None, aggregation="count", unit="count"))
    assert result["scope"]["emptyRows"] == 1
    assert result["metrics"][0]["value"] == 2
    assert result["metrics"][0]["evidence"][1]["locator"]["rowStart"] == 4


def test_selected_xlsx_sheet_and_formula_are_never_silently_totalled(tmp_path):
    from openpyxl import Workbook
    book = Workbook()
    book.active.title = "Revenue"
    book.active.append(["Channel", "Amount"])
    book.active.append(["A", 0.1])
    book.active.append(["B", 0.2])
    other = book.create_sheet("Other")
    other.append(["Channel", "Amount"])
    other.append(["A", 999])
    path = tmp_path / "sales.xlsx"
    book.save(path)
    result = analyze_table(extract_document(path), selection(sheet="Revenue", numberFormat="en"))
    assert result["metrics"][1]["value"] == 0.3
    assert len(result["document"]["chunks"]) == 1
    book.active.append(["A", "=1+1"])
    book.save(path)
    with pytest.raises(CalculationError, match="invalid-measure"):
        analyze_table(extract_document(path), selection(sheet="Revenue"))


def test_group_and_evidence_budgets_fail_without_truncation(tmp_path):
    data = document(tmp_path, 'G;V\n' + ''.join(f'{n};1\n' for n in range(13)))
    with pytest.raises(CalculationError, match="group-limit"):
        analyze_table(data, selection())


def test_output_precision_is_not_silently_lost():
    """A mathematically valid decimal must also survive the JSON number boundary."""
    from incagen_extract.server import calculate_request
    data = b"Measure\n999999999999.123456\n999999999999.123456\n"
    with pytest.raises(CalculationError, match="number-precision"):
        calculate_request(data, {"sourceId": "file-0", "fileName": "precision.csv", "selection": {
            "sheet": None, "valueColumn": 0, "groupColumn": None, "aggregation": "sum", "numberFormat": "plain", "unit": "number"}})


def test_group_names_with_edge_spaces_are_not_silently_merged(tmp_path):
    data = document(tmp_path, "Channel,Revenue\nWeb,10\n Web,20\n")
    with pytest.raises(CalculationError, match="invalid-group"):
        analyze_table(data, selection(numberFormat="plain", unit="number"))


@pytest.mark.parametrize("number_format", ["plain", "en", "tr"])
@pytest.mark.parametrize("aggregation", ["sum", "mean"])
def test_seeded_ledger_conserves_cents_groups_and_physical_evidence(tmp_path, number_format, aggregation):
    """Independent integer ledger spans parser chunks, refunds, blanks and uneven groups."""
    import random
    from fractions import Fraction

    rng = random.Random(20261110)
    ledger, lines = [], ["Service;Amount"]
    for group, count in [("Cloud", 273), ("Consulting", 119), ("Support", 37)]:
        for index in range(count):
            cents = 0 if index % 17 == 0 else rng.randrange(-250_000, 5_000_000)
            sign = "-" if cents < 0 else ""
            whole, fraction = divmod(abs(cents), 100)
            grouped = f"{whole:,}" if number_format != "plain" else str(whole)
            value = f"{sign}{grouped}.{fraction:02}"
            if number_format == "tr":
                value = value.translate(str.maketrans({",": ".", ".": ","}))
            lines.append(f"{group};{value}")
            ledger.append((group, cents, len(lines)))
            if index % 41 == 0:
                lines.append(";")
    data = document(tmp_path, "\n".join(lines) + "\n")
    assert len(data["chunks"]) > 1
    result = analyze_table(data, selection(numberFormat=number_format, aggregation=aggregation))

    # Fraction + integer cents is a separate oracle; round() uses ties-to-even.
    def answer(entries):
        """Round once at the final monetary boundary without floating-point arithmetic."""
        cents = sum(entry[1] for entry in entries)
        return Fraction(round(Fraction(cents, len(entries))) if aggregation == "mean" else cents, 100)

    assert Fraction(str(result["metrics"][1]["value"])) == answer(ledger)
    assert result["scope"]["rows"] == len(ledger)
    assert result["scope"]["emptyRows"] == len(lines) - 1 - len(ledger)
    groups = {group: [entry for entry in ledger if entry[0] == group] for group in {entry[0] for entry in ledger}}
    for metric in result["metrics"][1:]:
        expected = groups[metric["label"]] if "label" in metric else ledger
        assert Fraction(str(metric["value"])) == answer(expected)
        physical = []
        for anchor in metric["evidence"]:
            chunk = next(chunk for chunk in data["chunks"] if chunk["id"] == anchor["chunkId"])
            locator = anchor["locator"]
            assert anchor["sha256"] == data["sha256"] and anchor["sourceId"] == data["sourceId"]
            assert chunk["locator"]["rowStart"] <= locator["rowStart"] <= locator["rowEnd"] <= chunk["locator"]["rowEnd"]
            physical.extend(range(locator["rowStart"], locator["rowEnd"] + 1))
        assert physical == [entry[2] for entry in expected]
    if aggregation == "sum":
        assert sum(Fraction(str(point["value"])) for point in result["points"]) == answer(ledger)
