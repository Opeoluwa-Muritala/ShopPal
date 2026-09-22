"""AST-based static analysis and security auditing tool for Naija Marketplace backend."""

import ast
import os
import sys
from pathlib import Path


def audit_python_file(filepath: Path) -> list[str]:
    issues = []
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    try:
        tree = ast.parse(content, filename=str(filepath))
    except SyntaxError as e:
        return [f"SyntaxError in {filepath}: {e}"]

    for node in ast.walk(tree):
        # 1. Check for eval/exec/pickle
        if isinstance(node, ast.Call):
            func_name = ""
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr

            if func_name in ("eval", "exec"):
                issues.append(f"{filepath}:{node.lineno} - Unsafe dynamic code execution ({func_name})")
            if func_name in ("loads", "load") and getattr(node.func, "value", None) and getattr(node.func.value, "id", "") == "pickle":
                issues.append(f"{filepath}:{node.lineno} - Insecure deserialization via pickle")

        # 2. Check for hardcoded API keys in String literals
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            val = node.value
            if (val.startswith("sk_live_") and len(val) > 20) or (val.startswith("AC") and len(val) == 34 and "test" not in val):
                issues.append(f"{filepath}:{node.lineno} - Potential hardcoded secret detected: {val[:8]}...")

    return issues


def main():
    root = Path(__file__).resolve().parents[1] / "backend" / "app"
    all_issues = []
    for py_file in root.rglob("*.py"):
        issues = audit_python_file(py_file)
        all_issues.extend(issues)

    print("=== Static Security Scan Report (AST Analysis) ===")
    if not all_issues:
        print("PASS: Zero high-severity vulnerabilities found in backend/app/.")
    else:
        for issue in all_issues:
            print(f"WARN: {issue}")

    return 0 if not all_issues else 1


if __name__ == "__main__":
    sys.exit(main())
