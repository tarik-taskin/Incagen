"""Synthetic demo-project bridge; production uses private Cloud Run IAM."""

import base64
import json
import os
import sys

from .server import calculate_request
from .extract import MAX_BYTES


def main():
    """Read bounded stdin and metadata from the fixed backend child-process interface."""
    try:
        metadata = json.loads(base64.b64decode(os.environ["INCAGEN_WORKER_METADATA"], validate=True))
        result = calculate_request(sys.stdin.buffer.read(MAX_BYTES + 1), metadata)
        print(json.dumps({"result": result}, ensure_ascii=False, allow_nan=False))
    except Exception:
        print('{"error":"invalid-data"}')
        sys.exit(1)


if __name__ == "__main__":
    main()
