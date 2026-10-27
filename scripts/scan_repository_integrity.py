"""Reject repository patterns used by the October 2026 injected payload."""

from __future__ import annotations

import re
import sys
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {
    "", ".cjs", ".css", ".html", ".js", ".json", ".jsonc", ".jsx",
    ".md", ".mjs", ".ps1", ".py", ".sh", ".toml", ".ts", ".tsx",
    ".txt", ".yaml", ".yml",
}
MAX_TEXT_BYTES = 2_000_000

# These are intentionally narrow, high-signal rules. They target executable
# payloads hidden in assets and the automatic task/startup hooks used here.
RULES = {
    "node executing an asset": re.compile(
        r"\bnode(?:\.exe)?\s+[^\r\n]*(?:fonts?|fixtures?)[^\r\n]*\.(?:ttf|otf|woff2?|orc)\b",
        re.IGNORECASE,
    ),
    "automatic VS Code task": re.compile(r'"runOn"\s*:\s*"folderOpen"', re.IGNORECASE),
    "automatic VS Code task permission": re.compile(
        r'"task\.allowAutomaticTasks"\s*:\s*true', re.IGNORECASE
    ),
    "obfuscated decoder payload": re.compile(
        r"new\s+TextDecoder\s*\(\s*\).*?Uint8Array|"
        r"Uint8Array\s*\([^)]*\.match\s*\(/\.\{1,2\}/g",
        re.IGNORECASE,
    ),
}


def iter_files() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-co", "--exclude-standard", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    return [
        path
        for entry in result.stdout.split(b"\0")
        if entry and (path := ROOT / entry.decode("utf-8")).is_file()
    ]


def main() -> int:
    findings: list[str] = []
    for path in iter_files():
        relative = path.relative_to(ROOT)
        try:
            size = path.stat().st_size
        except OSError as exc:
            findings.append(f"{relative}: cannot inspect file: {exc}")
            continue

        # Executable code masquerading as a font or unknown asset is never
        # legitimate in this repository.
        if path.suffix.lower() in {".ttf", ".otf", ".woff", ".woff2", ".orc"}:
            try:
                prefix = path.read_bytes()[:512]
            except OSError as exc:
                findings.append(f"{relative}: cannot inspect asset: {exc}")
                continue
            if any(marker in prefix for marker in (b"function(", b"require(", b"module.exports", b"TextDecoder")):
                findings.append(f"{relative}: executable JavaScript hidden in an asset")

        if path.suffix.lower() not in TEXT_SUFFIXES or size > MAX_TEXT_BYTES:
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        if relative != Path("scripts/scan_repository_integrity.py"):
            for line in content.splitlines():
                for label, pattern in RULES.items():
                    if pattern.search(line):
                        findings.append(f"{relative}: {label}")

    if findings:
        print("Repository integrity scan FAILED:")
        for finding in sorted(set(findings)):
            print(f"- {finding}")
        return 1

    print("Repository integrity scan passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
