import pytest

from app.config import Settings
from app.services.llm import GemmaError
from scripts import benchmark_gemma_thinking as benchmark


def _setup(monkeypatch):
    monkeypatch.setattr(benchmark, "Settings", lambda: Settings(
        _env_file=None, gemma_api_key="benchmark-secret", gemma_model="gemma-4-26b-a4b-it",
    ))
    monkeypatch.setattr("sys.argv", ["benchmark_gemma_thinking.py", "--repeats", "2"])


def test_benchmark_compares_both_levels_without_executing_shopping_tools(monkeypatch, capsys):
    _setup(monkeypatch)
    calls = []

    def action(service, message, history, transcript):
        calls.append(service.thinking_level)
        assert service.fallback_provider is None
        assert service.timeout == 60
        if message.startswith("Show"):
            return {"tool": "searchProducts", "arguments": {"query": ""}}
        if message.startswith("I want"):
            return {"tool": "addToCart", "arguments": {"productId": benchmark.PRODUCT_ID, "quantity": 3}}
        return {"reply": "Which product would you like?"}

    monkeypatch.setattr(benchmark.BenchmarkService, "next_action", action)
    benchmark.main()
    output = capsys.readouterr().out
    assert calls.count("minimal") == calls.count("high") == 6
    assert calls[:2] == ["minimal", "high"]
    assert calls[6:8] == ["high", "minimal"]
    assert "medium: unsupported" in output
    assert "benchmark-secret" not in output
    assert output.count("expected_action=True") == 12


def test_benchmark_stops_on_repeated_connection_failures(monkeypatch):
    _setup(monkeypatch)
    calls = []

    def unavailable(service, *args):
        calls.append(service.thinking_level)
        raise GemmaError("Customer assistant request failed")

    monkeypatch.setattr(benchmark.BenchmarkService, "next_action", unavailable)
    with pytest.raises(SystemExit, match="Connection failed three times"):
        benchmark.main()
    assert len(calls) == 3
