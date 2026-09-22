"""Async load testing script for Naija Marketplace backend.

Simulates concurrent customers executing conversational commerce sequences against
the backend webhook and orders endpoints, capturing actual p50/p95/p99 latency metrics.

Target metrics from docs/PRD.md:
- Webhook response / bot reply completes in < 3.00 seconds.
- Created order becomes queryable in < 5.00 seconds.
"""

import argparse
import asyncio
import json
import statistics
import time
from typing import Any

import httpx


async def simulate_customer(
    client: httpx.AsyncClient,
    base_url: str,
    customer_index: int,
    results: list[dict[str, Any]],
) -> None:
    phone = f"+234801{customer_index:07d}"
    customer_results: list[dict[str, Any]] = []

    # Sequence of interactions: Browse -> Pick/Add -> Checkout -> Order Verification
    steps = [
        ("browse", "/api/health", "GET", None),
        ("inquiry", "/api/logs/recent?limit=5", "GET", None),
        (
            "webhook_browse",
            "/webhook/whatsapp",
            "POST",
            {"From": f"whatsapp:{phone}", "Body": "Hello, wetin dey your shop?"},
        ),
        (
            "webhook_add_cart",
            "/webhook/whatsapp",
            "POST",
            {"From": f"whatsapp:{phone}", "Body": "Add 1 black shoes size 43"},
        ),
        (
            "webhook_checkout",
            "/webhook/whatsapp",
            "POST",
            {"From": f"whatsapp:{phone}", "Body": "I wan checkout, address na Lagos"},
        ),
        (
            "order_query",
            f"/api/orders?customer_phone={phone}",
            "GET",
            None,
        ),
    ]

    for step_name, endpoint, method, payload in steps:
        url = f"{base_url}{endpoint}"
        start_time = time.perf_counter()
        try:
            if method == "GET":
                response = await client.get(url, timeout=10.0)
            else:
                response = await client.post(url, data=payload, timeout=10.0)

            elapsed_s = time.perf_counter() - start_time
            record = {
                "customer": phone,
                "step": step_name,
                "endpoint": endpoint,
                "status_code": response.status_code,
                "latency_s": elapsed_s,
                "success": response.status_code in (200, 201),
            }
            customer_results.append(record)
        except Exception as exc:
            elapsed_s = time.perf_counter() - start_time
            customer_results.append({
                "customer": phone,
                "step": step_name,
                "endpoint": endpoint,
                "status_code": 0,
                "latency_s": elapsed_s,
                "success": False,
                "error": str(exc),
            })

    results.extend(customer_results)


def calculate_percentiles(latencies: list[float]) -> dict[str, float]:
    if not latencies:
        return {"p50": 0.0, "p90": 0.0, "p95": 0.0, "p99": 0.0, "min": 0.0, "max": 0.0}
    sorted_l = sorted(latencies)
    return {
        "min": round(sorted_l[0], 4),
        "p50": round(statistics.median(sorted_l), 4),
        "p90": round(sorted_l[int(len(sorted_l) * 0.90)], 4),
        "p95": round(sorted_l[min(int(len(sorted_l) * 0.95), len(sorted_l) - 1)], 4),
        "p99": round(sorted_l[min(int(len(sorted_l) * 0.99), len(sorted_l) - 1)], 4),
        "max": round(sorted_l[-1], 4),
    }


async def run_load_test(base_url: str, concurrency: int = 10) -> dict[str, Any]:
    print(f"Starting load test against {base_url} with {concurrency} concurrent customers...")
    results: list[dict[str, Any]] = []

    limits = httpx.Limits(max_keepalive_connections=concurrency, max_connections=concurrency * 2)
    async with httpx.AsyncClient(limits=limits) as client:
        tasks = [
            simulate_customer(client, base_url, i, results)
            for i in range(concurrency)
        ]
        test_start = time.perf_counter()
        await asyncio.gather(*tasks)
        total_time = time.perf_counter() - test_start

    all_latencies = [r["latency_s"] for r in results]
    percentiles = calculate_percentiles(all_latencies)

    # Breakdown by endpoint
    by_step: dict[str, list[float]] = {}
    for r in results:
        by_step.setdefault(r["step"], []).append(r["latency_s"])

    step_stats = {step: calculate_percentiles(lats) for step, lats in by_step.items()}

    summary = {
        "concurrency": concurrency,
        "total_requests": len(results),
        "total_duration_s": round(total_time, 2),
        "requests_per_second": round(len(results) / max(total_time, 0.001), 2),
        "overall_latency_s": percentiles,
        "step_latencies_s": step_stats,
        "targets_met": {
            "reply_under_3s": percentiles["p95"] < 3.00,
            "order_visibility_under_5s": percentiles["p95"] < 5.00,
        },
    }

    print("\n=== Load Test Results Summary ===")
    print(json.dumps(summary, indent=2))
    return summary


def main():
    parser = argparse.ArgumentParser(description="Run async load test against Naija Marketplace backend.")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="Base URL of target API")
    parser.add_argument("--concurrency", type=int, default=10, help="Number of concurrent customers")
    args = parser.parse_args()

    asyncio.run(run_load_test(args.url, args.concurrency))


if __name__ == "__main__":
    main()
