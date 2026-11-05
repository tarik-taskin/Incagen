"""Private Cloud Run HTTP boundary; no Firebase, Gemini or storage credentials."""

from __future__ import annotations

from contextlib import nullcontext
import base64
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import multiprocessing
import os
from pathlib import Path
import tempfile
import sys

from .analyze import CalculationError, analyze_table
from .extract import ExtractionError, MAX_BYTES, extract_document

MAX_RESPONSE_BYTES = 4 * 1024 * 1024


def calculate_request(data: bytes, metadata: dict, directory: str | None = None) -> dict:
    """Use a generated temporary filename; user input never becomes a filesystem path."""
    if set(metadata) != {"sourceId", "fileName", "selection"} or not isinstance(metadata["fileName"], str):
        raise CalculationError("invalid-selection")
    name = metadata["fileName"]
    if not 0 < len(name) <= 200 or Path(name).name != name or "\\" in name or Path(name).suffix.lower() not in {".csv", ".xlsx"}:
        raise CalculationError("unsupported-table")
    if not 0 < len(data) <= MAX_BYTES:
        raise CalculationError("file-size")
    with (nullcontext(directory) if directory else tempfile.TemporaryDirectory(prefix="incagen-")) as workdir:
        path = Path(workdir) / ("source" + Path(name).suffix.lower())
        path.write_bytes(data)
        document = extract_document(path, metadata["sourceId"])
        document["fileName"] = name
        return analyze_table(document, metadata["selection"])


def isolated_calculation(connection, data: bytes, metadata: dict, directory: str) -> None:
    """Bound CPU/address space and return only stable failures, never raw parser exceptions."""
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_CPU, (40, 40))
        # Cloud Run is Linux; macOS rejects RLIMIT_AS even for an isolated local test child.
        if sys.platform == "linux":
            resource.setrlimit(resource.RLIMIT_AS, (768 * 1024 * 1024, 768 * 1024 * 1024))
        result = {"result": calculate_request(data, metadata, directory)}
        encoded = json.dumps(result, ensure_ascii=False, allow_nan=False).encode("utf8")
        if len(encoded) > MAX_RESPONSE_BYTES:
            raise CalculationError("result-budget")
    except CalculationError as error:
        encoded = json.dumps({"error": str(error)}).encode("utf8")
    except ExtractionError:
        encoded = b'{"error":"parse-failed"}'
    except Exception:
        encoded = b'{"error":"worker-failed"}'
    try:
        connection.send_bytes(encoded)
    finally:
        connection.close()


class Handler(BaseHTTPRequestHandler):
    """Cloud Run IAM authenticates requests before they reach this private container."""

    def log_message(self, *_):
        """Do not log request headers, paths, documents or parser responses."""

    def respond(self, status: int, encoded: bytes) -> None:
        """Serve bounded JSON with private/no-store caching."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        """Expose only a content-free startup health probe."""
        self.respond(200 if self.path == "/healthz" else 404, b'{"status":"ok"}' if self.path == "/healthz" else b'{"error":"not-found"}')

    def do_POST(self):
        """Accept one bounded raw file plus strict metadata; kill timed-out child processes."""
        process = None
        parent = None
        temporary = None
        try:
            if self.path != "/analyze" or self.headers.get("Content-Type") != "application/octet-stream" or self.headers.get("Transfer-Encoding"):
                self.respond(400, b'{"error":"invalid-request"}')
                return
            length = int(self.headers.get("Content-Length", "0"))
            raw_metadata = self.headers.get("X-Incagen-Metadata", "")
            if not 0 < length <= MAX_BYTES or not 0 < len(raw_metadata) <= 4096:
                raise ValueError()
            metadata = json.loads(base64.b64decode(raw_metadata, validate=True))
            if not isinstance(metadata, dict):
                raise ValueError()
            self.connection.settimeout(15)
            data = self.rfile.read(length)
            if len(data) != length:
                raise ValueError()
            temporary = tempfile.TemporaryDirectory(prefix="incagen-request-")
            context = multiprocessing.get_context("spawn")
            parent, child = context.Pipe(duplex=False)
            process = context.Process(target=isolated_calculation, args=(child, data, metadata, temporary.name))
            process.start()
            child.close()
            if not parent.poll(55):
                self.respond(422, b'{"error":"worker-timeout"}')
                return
            encoded = parent.recv_bytes(MAX_RESPONSE_BYTES)
            result = json.loads(encoded)
            self.respond(200 if "result" in result else 422, encoded)
        except (ValueError, EOFError, OSError):
            self.respond(400, b'{"error":"invalid-request"}')
        finally:
            if parent:
                parent.close()
            if process:
                process.join(timeout=1)
                if process.is_alive():
                    process.kill()
                    process.join(timeout=1)
            if temporary:
                temporary.cleanup()


def main() -> None:
    """Run one request at a time; Cloud Run concurrency and scaling are bounded separately."""
    host = "0.0.0.0" if os.environ.get("K_SERVICE") else "127.0.0.1"
    HTTPServer((host, int(os.environ.get("PORT", "8080"))), Handler).serve_forever()


if __name__ == "__main__":
    main()
