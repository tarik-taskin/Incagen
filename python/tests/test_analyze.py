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


def test_equal_group_values_sort_deterministically_by_label(tmp_path):
    """Kanıt: Aynı toplama sahip gruplar azalan değer + artan etiket sırasıyla kararlı sıralanır."""
    data = document(tmp_path, "Team,Revenue\nGamma,50.00\nAlpha,25.00\nBeta,50.00\nAlpha,25.00\n")
    result = analyze_table(data, selection(numberFormat="en", unit="USD"))
    assert [(point["label"], point["value"]) for point in result["points"]] == [
        ("Alpha", 50.0),
        ("Beta", 50.0),
        ("Gamma", 50.0),
    ]
    assert result["metrics"][1]["value"] == 150.0


def test_monetary_half_even_rounding_and_subcent_rejection(tmp_path):
    """Kanıt: Parasal ortalamada yarı-çift (ROUND_HALF_EVEN) yuvarlama uygulanır; 3 ondalıklı para girdisi reddedilir."""
    # (10.00 + 10.01) / 2 = 10.005 -> 10.00 (çift); (10.01 + 10.02) / 2 = 10.015 -> 10.02 (çift)
    even_down = analyze_table(
        document(tmp_path, "Group;Amount\nA;10,00\nA;10,01\n"),
        selection(aggregation="mean", numberFormat="tr", unit="TRY"),
    )
    assert even_down["metrics"][1]["value"] == 10.0

    even_up = analyze_table(
        document(tmp_path, "Group;Amount\nB;10,01\nB;10,02\n"),
        selection(aggregation="mean", numberFormat="tr", unit="TRY"),
    )
    assert even_up["metrics"][1]["value"] == 10.02

    # Para biriminde kuruş altı hassasiyet sessizce yuvarlanmaz; currency-precision ile reddedilir.
    with pytest.raises(CalculationError, match="currency-precision"):
        analyze_table(document(tmp_path, "Group;Amount\nA;10,125\n"), selection(numberFormat="tr", unit="TRY"))


def test_real_zero_and_negative_values_preserve_denominator_while_blanks_fail(tmp_path):
    """Kanıt: Gerçek sıfır ve negatif değerler ortalamada paydada tutulur; boş veya boolean hücre sıfır yapılmaz."""
    # Toplam ortalama: (-30 + 0 + 60) / 3 = 10.0; Web ortalaması (-30 + 0) / 2 = -15.0 (0 paydada kalır)
    zero_mean = analyze_table(
        document(tmp_path, "Channel,Delta\nWeb,-30.00\nWeb,0.00\nStore,60.00\n"),
        selection(aggregation="mean", numberFormat="en", unit="USD"),
    )
    assert zero_mean["metrics"][1]["value"] == 10.0
    assert [(p["label"], p["value"]) for p in zero_mean["points"]] == [("Store", 60.0), ("Web", -15.0)]

    # Boş hücre veya mantıksal metin değeri sıfır sayılmaz.
    for bad_csv in ["Channel,Delta\nWeb,\nStore,10\n", "Channel,Delta\nWeb,true\nStore,10\n"]:
        with pytest.raises(CalculationError):
            analyze_table(document(tmp_path, bad_csv), selection(aggregation="mean", numberFormat="en", unit="number"))


def test_xlsx_sum_count_mean_with_unselected_invalid_sheet_and_exact_locators(tmp_path):
    """Kanıt: XLSX seçili sayfa dışındaki bozuk/formüllü sayfayı yoksayar; sum/count/mean, negatif/sıfır ve sheet bağını korur."""
    from openpyxl import Workbook

    book = Workbook()
    selected = book.active
    selected.title = "Q4-Sales"
    selected.append(["Region", "Net"])
    selected.append(["North", 100.5])
    selected.append([None, None])  # Tamamen boş satır count ve sum dışında sayılır (emptyRows=1)
    selected.append(["South", -20.5])
    selected.append(["North", 0])
    selected.append(["South", True])  # Seçili sayfada değil başka sütun veya yalnız count için değil: bu satırı ayrı sayfada bozuk test edelim

    # Düzeltme: Q4-Sales geçerli sayısal değerler taşısın; Ignored-Sheet geçersiz formül ve dev tutar taşısın.
    selected.delete_rows(6)
    ignored = book.create_sheet("Ignored-Broken")
    ignored.append(["Region", "Net"])
    ignored.append(["North", "=SUM(A1:A2)"])
    ignored.append(["North", "invalid-text"])
    ignored.append(["North", 999999])

    path = tmp_path / "multi-sheet.xlsx"
    book.save(path)
    extracted = extract_document(path)

    # 1. XLSX SUM: (100.50 - 20.50 + 0) = 80.00; North=100.50, South=-20.50
    sum_res = analyze_table(extracted, selection(sheet="Q4-Sales", aggregation="sum", numberFormat="plain", unit="EUR"))
    assert sum_res["metrics"][1]["value"] == 80.0
    assert sum_res["scope"]["emptyRows"] == 1
    assert [(p["label"], p["value"]) for p in sum_res["points"]] == [("North", 100.5), ("South", -20.5)]
    assert [a["locator"] for a in sum_res["metrics"][2]["evidence"]] == [
        {"sheet": "Q4-Sales", "rowStart": 2, "rowEnd": 2},
        {"sheet": "Q4-Sales", "rowStart": 5, "rowEnd": 5},
    ]

    # 2. XLSX MEAN: (100.50 + (-20.50) + 0) / 3 = 80 / 3 = 26.666667 (6 ondalık)
    mean_res = analyze_table(extracted, selection(sheet="Q4-Sales", aggregation="mean", numberFormat="plain", unit="number"))
    assert mean_res["metrics"][1]["value"] == 26.666667

    # 3. XLSX COUNT: 3 dolu satır, boş satır (row 3) atlanır ve sheet locator korunur
    count_res = analyze_table(extracted, selection(sheet="Q4-Sales", valueColumn=None, groupColumn=None, aggregation="count", numberFormat="plain", unit="count"))
    assert count_res["metrics"][0]["value"] == 3
    assert count_res["metrics"][1]["value"] == 3
    assert count_res["scope"]["emptyRows"] == 1
    assert [a["locator"] for a in count_res["metrics"][1]["evidence"]] == [
        {"sheet": "Q4-Sales", "rowStart": 2, "rowEnd": 2},
        {"sheet": "Q4-Sales", "rowStart": 4, "rowEnd": 5},
    ]

    # 4. Seçilen sayfada boolean değer varsa asla 1 veya 0 sayılamaz
    selected.append(["South", False])
    book.save(path)
    with pytest.raises(CalculationError, match="invalid-measure"):
        analyze_table(extract_document(path), selection(sheet="Q4-Sales", aggregation="sum", numberFormat="plain", unit="number"))
