"""Offline JSON CLI; provider keys and cloud credentials are not required."""
import argparse
import json
import sys

from .extract import ExtractionError, extract_document


def main() -> int:
    """Write a normalized document to stdout; keep failure messages bounded and source-free."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path")
    parser.add_argument("--source-id", default="file-0")
    args = parser.parse_args()
    try:
        print(json.dumps(extract_document(args.path, args.source_id), ensure_ascii=False, allow_nan=False))
        return 0
    except (ExtractionError, OSError):
        print("Document extraction failed; check format and limits.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
