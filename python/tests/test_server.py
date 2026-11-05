"""The private worker accepts files, never paths, URLs, executable code or provider keys."""

import pytest

from incagen_extract.analyze import CalculationError
from incagen_extract.server import calculate_request


def test_raw_bytes_preserve_original_identity_and_decimal_result():
    data = b"Channel,Revenue\nWeb,0.10\nStore,0.20\n"
    response = calculate_request(data, {"sourceId": "file-1", "fileName": "Revenue.csv", "selection": {
        "sheet": None, "valueColumn": 1, "groupColumn": 0, "aggregation": "sum", "numberFormat": "en", "unit": "USD"}})
    assert response["document"]["sourceId"] == "file-1"
    assert response["document"]["fileName"] == "Revenue.csv"
    assert response["metrics"][1]["value"] == 0.3


@pytest.mark.parametrize("name", ["../revenue.csv", "/tmp/revenue.csv", "https://example.com/revenue.csv", "a\\b.csv", "code.py", "image.png"])
def test_file_paths_urls_and_other_formats_are_rejected(name):
    with pytest.raises(CalculationError):
        calculate_request(b"A,B\n1,2\n", {"sourceId": "file-0", "fileName": name, "selection": {}})


def test_killed_request_removes_parent_owned_temporary_directory(monkeypatch, tmp_path):
    """A timed-out parser cannot leave an uploaded document in the warm container."""
    import base64
    import io
    import json
    from incagen_extract import server
    created = []
    original = server.tempfile.TemporaryDirectory

    def temporary(**kwargs):
        item = original(dir=tmp_path, **kwargs)
        created.append(item.name)
        return item

    class Connection:
        def poll(self, _timeout):
            return False

        def close(self):
            pass

    class Process:
        alive = True

        def __init__(self, target, args):
            from pathlib import Path
            Path(args[-1], "source.csv").write_bytes(args[1])

        def start(self):
            pass

        def join(self, timeout):
            pass

        def is_alive(self):
            return self.alive

        def kill(self):
            self.alive = False

    class Context:
        @staticmethod
        def Pipe(duplex):
            return Connection(), Connection()

    Context.Process = Process

    class Socket:
        def settimeout(self, timeout):
            pass

    monkeypatch.setattr(server.tempfile, "TemporaryDirectory", temporary)
    monkeypatch.setattr(server.multiprocessing, "get_context", lambda _method: Context())
    handler = server.Handler.__new__(server.Handler)
    handler.path = "/analyze"
    handler.headers = {"Content-Type": "application/octet-stream", "Content-Length": "4", "X-Incagen-Metadata": base64.b64encode(json.dumps({}).encode()).decode()}
    handler.rfile = io.BytesIO(b"data")
    handler.connection = Socket()
    responses = []
    handler.respond = lambda status, body: responses.append((status, body))
    handler.do_POST()
    assert responses == [(422, b'{"error":"worker-timeout"}')]
    from pathlib import Path
    assert created and all(not Path(directory).exists() for directory in created)


def test_real_isolated_child_returns_verified_result_and_exits(tmp_path):
    """Exercise the actual spawn/IPC and resource-limit boundary without a network listener."""
    import json
    import multiprocessing
    from incagen_extract.server import isolated_calculation, MAX_RESPONSE_BYTES
    context = multiprocessing.get_context("spawn")
    parent, child = context.Pipe(duplex=False)
    metadata = {"sourceId": "file-0", "fileName": "revenue.csv", "selection": {
        "sheet": None, "valueColumn": 1, "groupColumn": None, "aggregation": "sum", "numberFormat": "plain", "unit": "USD"}}
    process = context.Process(target=isolated_calculation, args=(child, b"Channel,Revenue\nWeb,0.10\nStore,0.20\n", metadata, str(tmp_path)))
    try:
        process.start()
        child.close()
        assert parent.poll(15)
        result = json.loads(parent.recv_bytes(MAX_RESPONSE_BYTES))
        assert result["result"]["metrics"][1]["value"] == 0.3
        process.join(timeout=5)
        assert process.exitcode == 0
    finally:
        parent.close()
        if process.is_alive():
            process.kill()
            process.join(timeout=5)
