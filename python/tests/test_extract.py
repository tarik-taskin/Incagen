"""Synthetic fixtures prove extraction, source locations and the TypeScript boundary."""
import hashlib
import io
import json
import subprocess
import zipfile
from pathlib import Path

import pytest
from docx import Document
from openpyxl import Workbook
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import SimpleDocTemplate, Table

from incagen_extract import ExtractionError, extract_document, profile_table
from incagen_extract.extract import inspect_office


@pytest.fixture
def documents(tmp_path):
    """Generate small disposable documents without using customer or answer-key content."""
    csv = tmp_path / "sales.csv"
    csv.write_text('item,amount\nA,100\nB,250\n', encoding="utf-8")
    docx = tmp_path / "brief.docx"
    word = Document()
    word.add_heading("Quarterly brief", 0)
    word.add_paragraph("Revenue increased. Review costs before making a decision.")
    table = word.add_table(rows=1, cols=2)
    table.rows[0].cells[0].text, table.rows[0].cells[1].text = "item", "amount"
    cells = table.add_row().cells
    cells[0].text, cells[1].text = "A", "100"
    word.save(docx)
    xlsx = tmp_path / "sales.xlsx"
    book = Workbook()
    sheet = book.active
    sheet.title = "Sales"
    for row in [["item", "amount"], ["A", 100], [None, None], ["B", 250], ["Total", "=SUM(B2:B4)"]]:
        sheet.append(row)
    book.save(xlsx)
    pdf = tmp_path / "brief.pdf"
    canvas = Canvas(str(pdf))
    canvas.drawString(50, 780, "Quarterly brief")
    canvas.showPage()
    canvas.drawString(50, 780, "Revenue increased; costs need review.")
    canvas.save()
    return [csv, docx, xlsx, pdf]


@pytest.mark.parametrize("number", range(4))
def test_source_contract(documents, number):
    """Every format passes the existing server packet validator with its original hash."""
    path = documents[number]
    document = extract_document(path)
    assert document["sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
    assert all(chunk["locator"] for chunk in document["chunks"])
    root = Path(__file__).resolve().parents[2]
    script = "const fs=require('fs');const {buildAnalysisPacket}=require('./functions/lib/analysis/input-packet');const d=JSON.parse(fs.readFileSync(0,'utf8'));const p=buildAnalysisPacket({analysisId:'python-test',objective:'Explain the documents.',documents:[d]});console.log(p.usage.documents)"
    result = subprocess.run(["node", "-e", script], input=json.dumps(document), text=True, capture_output=True, cwd=root, check=True)
    assert result.stdout.strip() == "1"


def test_word_preserves_body_order_and_table(documents):
    document = extract_document(documents[1])
    assert [chunk["kind"] for chunk in document["chunks"]] == ["text", "text", "table"]
    assert document["chunks"][0]["text"] == "Quarterly brief"
    assert document["chunks"][2]["table"]["rows"] == [["A", "100"]]


def test_xlsx_never_executes_formulas_and_keeps_blank_rows(documents):
    document = extract_document(documents[2])
    chunk = document["chunks"][0]
    assert chunk["locator"] == {"sheet": "Sales", "rowStart": 2, "rowEnd": 5}
    assert chunk["table"]["rows"] == [["A", 100], [None, None], ["B", 250], ["Total", None]]
    assert "formulas are not evaluated" in document["warnings"][0]
    assert profile_table(chunk) == {"rows": 4, "columns": 2, "missingByColumn": {"item": 1, "amount": 2}}


def test_pdf_page_locations_and_scan_warning(tmp_path, documents):
    document = extract_document(documents[3])
    assert [chunk["locator"] for chunk in document["chunks"]] == [{"page": 1}, {"page": 2}]
    path = tmp_path / "scan.pdf"
    canvas = Canvas(str(path)); canvas.showPage(); canvas.save()
    scan = extract_document(path)
    assert scan["chunks"][0]["kind"] == "image"
    assert "OCR is not enabled" in scan["warnings"][0]


def test_pdf_extracts_tables_and_marks_overlapping_views(tmp_path):
    path = tmp_path / "table.pdf"
    SimpleDocTemplate(str(path)).build([Table([["item", "amount"], ["A", "100"]], style=[("GRID", (0, 0), (-1, -1), 1, "black")])])
    document = extract_document(path)
    tables = [chunk for chunk in document["chunks"] if chunk["kind"] == "table"]
    assert tables[0]["table"]["rows"] == [["A", "100"]]
    assert "may overlap" in document["warnings"][0]


@pytest.mark.parametrize("content", [b'not a pdf', b'%PDF-invalid'])
def test_rejects_corrupt_pdf(tmp_path, content):
    path = tmp_path / "bad.pdf"; path.write_bytes(content)
    with pytest.raises(ExtractionError):
        extract_document(path)


def test_rejects_encrypted_pdf(tmp_path):
    from reportlab.lib.pdfencrypt import StandardEncryption
    path = tmp_path / "locked.pdf"
    canvas = Canvas(str(path), encrypt=StandardEncryption("password"))
    canvas.drawString(50, 780, "Private"); canvas.save()
    with pytest.raises(ExtractionError):
        extract_document(path)


def test_rejects_dangerous_office_archive():
    for name, body in [("../escape", b"x"), ("xl/vbaProject.bin", b"x"), ("word/_rels/document.xml.rels", b'<Relationships><Relationship TargetMode="External" Target="https://example.test"/></Relationships>'), ("word/document.xml", b'<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>')]:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            if name != "word/document.xml": archive.writestr("word/document.xml", "<document/>")
            archive.writestr(name, body)
        with pytest.raises(ExtractionError): inspect_office(buffer.getvalue(), "word/document.xml")


def test_csv_retains_text_and_rejects_inconsistent_rows(tmp_path):
    path = tmp_path / "localized.csv"
    path.write_text('item;amount\nA;"1.234,56"\n', encoding="utf-8")
    assert extract_document(path)["chunks"][0]["table"]["rows"][0][1] == "1.234,56"
    path.write_text('a,b\n1,2,3\n4,5\n', encoding="utf-8")
    with pytest.raises(ExtractionError): extract_document(path)


def test_size_and_identity_boundaries(tmp_path):
    path = tmp_path / "empty.txt"; path.write_text("")
    with pytest.raises(ExtractionError): extract_document(path)
    path.write_bytes(b"x" * (25 * 1024 * 1024 + 1))
    with pytest.raises(ExtractionError): extract_document(path)
    with pytest.raises(ExtractionError): extract_document(path, "../../bad")


def test_large_csv_chunks_keep_row_ranges(tmp_path):
    path = tmp_path / "many.csv"
    path.write_text("item,amount\n" + "".join(f"A{i},{i}\n" for i in range(501)))
    chunks = extract_document(path)["chunks"]
    assert [chunk["locator"]["rowStart"] for chunk in chunks] == [2, 252, 502]
    assert [chunk["locator"]["rowEnd"] for chunk in chunks] == [251, 501, 502]
