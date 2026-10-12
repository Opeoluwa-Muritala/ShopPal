"""Opt-in live Gemma benchmark using synthetic shopping context only.

No shopping tools execute and no Bumpa, WhatsApp, or database calls are made.
Gemma 4 has no native medium level; compare its supported levels fairly.
"""

import argparse
import logging
import statistics
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import Settings  # noqa: E402
from app.services.llm import GemmaError, LLMService  # noqa: E402

PRODUCT_ID = "acff33f8-9a11-464e-a542-a101670add1e"
CASES: list[dict[str, Any]] = [
    {"name": "browse", "message": "Show me what products are available", "history": [], "transcript": [], "tool": "searchProducts"},
    {"name": "contextual selection", "message": "I want three of the second one", "history": [
        {"role": "assistant", "content": "1. Cedar Mist. 2. Rose Bloom. Which would you like?"},
    ], "transcript": [{"action": {"tool": "searchProducts", "arguments": {"query": ""}}, "result": {"products": [
        {"product_id": "bccf33f8-9a11-464e-a542-a101670add1e", "name": "Cedar Mist", "price": "1000", "stock": 10},
        {"product_id": PRODUCT_ID, "name": "Rose Bloom", "price": "2000", "stock": 10},
    ]}}], "tool": "addToCart"},
    {"name": "ambiguous selection", "message": "Add that one", "history": [], "transcript": [], "tool": None},
]


class BenchmarkService(LLMService):
    finish_reason: str | None = None

    def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        raw = super()._post(payload)
        candidates = raw.get("candidates") or [{}]
        self.finish_reason = candidates[0].get("finishReason")
        return raw


def _correct(case: dict[str, Any], action: dict[str, Any]) -> bool:
    if case["tool"] is None:
        return bool(action.get("reply")) and "tool" not in action
    if action.get("tool") != case["tool"]:
        return False
    args = action.get("arguments", {})
    if case["tool"] == "searchProducts":
        return args.get("query") == ""
    return args.get("productId") == PRODUCT_ID and args.get("quantity") == 3


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repeats", type=int, choices=range(1, 6), default=2)
    args = parser.parse_args()
    logging.disable(logging.CRITICAL)
    # Equal timeout for both levels; never change the application's timeout.
    settings = Settings().model_copy(update={"gemma_timeout_seconds": 60})
    if not settings.gemma_api_key.get_secret_value():
        raise SystemExit("GEMMA_API_KEY is required")
    if not settings.gemma_model.startswith("gemma-4-"):
        raise SystemExit("This benchmark requires a Gemma 4 model")
    results: dict[tuple[str, str], list[tuple[float, bool, bool]]] = {}
    consecutive_connection_failures = 0
    print("medium: unsupported by Gemma 4; no medium requests sent", flush=True)
    for iteration in range(args.repeats):
        # Reverse level order each round to reduce warm-up/order bias.
        levels = ("minimal", "high") if iteration % 2 == 0 else ("high", "minimal")
        for case in CASES:
            for level in levels:
                service = BenchmarkService(settings, thinking_level=level)
                service.fallback_provider = None
                started = time.monotonic()
                try:
                    action = service.next_action(case["message"], case["history"], case["transcript"])
                except GemmaError as exc:
                    elapsed = time.monotonic() - started
                    results.setdefault((case["name"], level), []).append((elapsed, False, False))
                    print(f"{case['name']:<22} {level:<8} {elapsed:.2f}s failed: {exc}; HTTP {exc.status_code}; finish={service.finish_reason}", flush=True)
                    if exc.status_code == 429:
                        raise SystemExit("Rate limited; stop rather than retrying") from None
                    if exc.status_code is None and service.finish_reason is None:
                        consecutive_connection_failures += 1
                        if consecutive_connection_failures >= 3:
                            raise SystemExit("Connection failed three times; comparison incomplete") from None
                    else:
                        consecutive_connection_failures = 0
                    continue
                consecutive_connection_failures = 0
                elapsed = time.monotonic() - started
                correct = _correct(case, action)
                results.setdefault((case["name"], level), []).append((elapsed, correct, True))
                print(f"{case['name']:<22} {level:<8} {elapsed:.2f}s expected_action={correct}", flush=True)
    print("\ncase                   level    median_success_seconds  correct/attempts  errors", flush=True)
    for (name, level), values in results.items():
        successful = [value[0] for value in values if value[2]]
        latency = f"{statistics.median(successful):.2f}" if successful else "n/a"
        print(f"{name:<22} {level:<8} {latency:>22}  {sum(v[1] for v in values)}/{len(values)}  {sum(not v[2] for v in values)}")
    if any(not item[2] for values in results.values() for item in values):
        raise SystemExit("Some requests failed; do not treat this as a reliable speed comparison")


if __name__ == "__main__":
    main()
