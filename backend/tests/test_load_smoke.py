"""CI-runnable lightweight load test smoke check (3 concurrent requests)."""

import asyncio
import time

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_load_smoke_concurrency():
    """Verify that multiple concurrent requests complete within SLA (< 3.0s) without errors."""
    transport = ASGITransport(app=app)
    concurrency = 3
    auth_headers = {"X-Admin-API-Key": "demo_admin_secret_key"}

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        async def fetch_sequence(i: int):
            start = time.perf_counter()
            r1 = await client.get("/api/health")
            r2 = await client.get("/api/logs/recent?limit=5", headers=auth_headers)
            elapsed = time.perf_counter() - start
            return r1.status_code, r2.status_code, elapsed

        tasks = [fetch_sequence(i) for i in range(concurrency)]
        results = await asyncio.gather(*tasks)

        for status1, status2, elapsed in results:
            assert status1 == 200, f"Health check failed with {status1}"
            assert status2 == 200, f"Logs check failed with {status2}"
            # Assert latency is well within PRD < 3.0s target
            assert elapsed < 3.0, f"Latency {elapsed}s exceeded target SLA"
