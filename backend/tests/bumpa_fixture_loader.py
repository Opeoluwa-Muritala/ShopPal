"""Load explicitly hypothetical Bumpa responses without accepting real data."""

import json
from pathlib import Path
from typing import Any

HANDWRITTEN = Path(__file__).parent / "fixtures" / "bumpa" / "handwritten"
HEADER = "// HAND-WRITTEN FROM DOCS, NOT REAL BUMPA OUTPUT"


def load_handwritten(name: str) -> Any:
    path = HANDWRITTEN / name
    if path.parent != HANDWRITTEN or path.suffix != ".jsonc":
        raise ValueError("Invalid fixture name")
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0] != HEADER:
        raise ValueError("Hand-written fixture header is missing")
    return json.loads("\n".join(lines[1:]))
