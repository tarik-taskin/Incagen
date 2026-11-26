"""Sentetik worker kabulü. Cloud Build, gerçek Linux konteynerinde çalıştırır."""

import hashlib
from io import BytesIO
import json
import multiprocessing
import tempfile

from incagen_extract.server import MAX_RESPONSE_BYTES, isolated_calculation
from openpyxl import Workbook


def worker_result(data, file_name, selection):
    """Özel worker’ın kullandığı spawn/IPC ve kaynak sınırı yolundan tek dosya geçir."""
    ctx = multiprocessing.get_context("spawn")
    parent, child = ctx.Pipe(duplex=False)
    with tempfile.TemporaryDirectory() as work:
        metadata = {"sourceId": "file-0", "fileName": file_name, "selection": selection}
        process = ctx.Process(target=isolated_calculation, args=(child, data, metadata, work))
        process.start()
        child.close()
        try:
            assert parent.poll(20), "worker IPC timeout"
            response = json.loads(parent.recv_bytes(MAX_RESPONSE_BYTES))
            process.join(5)
            assert process.exitcode == 0 and "result" in response, "worker result missing"
        finally:
            parent.close()
            if process.is_alive():
                process.kill()
                process.join(2)
    result = response["result"]
    assert result["document"]["sha256"] == hashlib.sha256(data).hexdigest()
    return result


def check_case(data, file_name, sheet, aggregation, expected, expected_rows):
    """Bağımsız cevap anahtarıyla toplamı, seçili sayfayı ve fiziksel dayanakları doğrula."""
    selection = {"sheet": sheet, "valueColumn": 1, "groupColumn": None, "aggregation": aggregation, "numberFormat": "plain", "unit": "USD"}
    result = worker_result(data, file_name, selection)
    assert result["scope"]["sheet"] == sheet
    metrics = {entry["id"]: entry for entry in result["metrics"]}
    assert metrics["aggregate"]["value"] == expected
    assert metrics["rows"]["value"] == len(expected_rows)
    locators = [entry["locator"] for entry in metrics["aggregate"]["evidence"]]
    assert all(locator.get("sheet") == sheet for locator in locators)
    actual_rows = [row for item in locators for row in range(item["rowStart"], item["rowEnd"] + 1)]
    assert actual_rows == expected_rows


def main():
    """CSV boş satırını ve XLSX seçili çalışma sayfasını ayrı bağımsız vakalarla doğrula."""
    check_case(b"Channel,Amount\nWeb,0.10\n\nStore,0.20\n", "worker.csv", None, "sum", 0.3, [2, 4])
    workbook = Workbook()
    workbook.active.title = "Excluded"
    workbook.active.append(["Channel", "Amount"])
    workbook.active.append(["Other", 9999])
    sheet = workbook.create_sheet("Services")
    sheet.append(["Channel", "Amount"])
    sheet.append(["Web", 10])
    sheet.append(["Store", 30])
    with BytesIO() as buffer:
        workbook.save(buffer)
        check_case(buffer.getvalue(), "worker.xlsx", "Services", "mean", 20, [2, 3])
    print("Worker CSV and XLSX acceptance passed")


if __name__ == "__main__":
    main()
