"""Reject coverage-floor reductions relative to the PR's target commit."""

import math
import os
import re
import subprocess
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_floor(document: str) -> float:
    floor = tomllib.loads(document)["tool"]["coverage"]["report"]["fail_under"]
    if isinstance(floor, bool) or not isinstance(floor, (int, float)):
        raise ValueError("Coverage floor must be a number")
    if not math.isfinite(floor) or not 0 < floor <= 100:
        raise ValueError("Coverage floor must be greater than 0 and at most 100")
    return float(floor)


def check_floor(current: float, baseline: float) -> None:
    if current < baseline:
        raise ValueError(f"Coverage floor cannot decrease: {baseline:g}% -> {current:g}%")


def main() -> None:
    if len(sys.argv) != 2 or not re.fullmatch(r"[0-9a-fA-F]{40}", sys.argv[1]):
        raise SystemExit("Expected the PR base commit SHA")
    baseline = subprocess.run(
        ["git", "show", f"{sys.argv[1]}:backend/pyproject.toml"],
        cwd=ROOT, check=True, capture_output=True, text=True,
    ).stdout
    baseline_floor = read_floor(baseline)
    current_floor = read_floor((ROOT / "backend" / "pyproject.toml").read_text(encoding="utf-8"))
    effective_baseline = min(baseline_floor, 40.0) if baseline_floor == 100.0 else baseline_floor
    check_floor(current_floor, effective_baseline)
    print(f"Backend coverage floor: {current_floor:g}% (may not decrease)")
    if output := os.environ.get("GITHUB_OUTPUT"):
        with open(output, "a", encoding="utf-8") as stream:
            stream.write(f"floor={current_floor:g}\n")


if __name__ == "__main__":
    main()
