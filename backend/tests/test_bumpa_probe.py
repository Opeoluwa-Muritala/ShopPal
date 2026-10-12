"""Probe safeguards are tested without executing its network flow."""

from pathlib import Path

from pydantic import SecretStr

from scripts.bumpa_probe import ProbeSettings, _redact, _save


def test_probe_redacts_keys_tokens_and_location_in_local_capture(tmp_path, monkeypatch):
    from scripts import bumpa_probe

    monkeypatch.setattr(bumpa_probe, "REAL", tmp_path)
    settings = ProbeSettings(
        _env_file=None,
        bumpa_public_key=SecretStr("public-test-key"),
        bumpa_secret_key=SecretStr("secret-test-key"),
        bumpa_location_id="location-1",
    )
    raw = {"api_key": "public-test-key", "nested": {"cart_token": "cart-test", "url": "https://example.com/secret-test-key/location-1"}}
    _save("sample", raw, settings)
    output = (tmp_path / "sample.json").read_text(encoding="utf-8")
    assert "public-test-key" not in output
    assert "secret-test-key" not in output
    assert "location-1" not in output
    assert "cart-test" not in output
    assert "[REDACTED]" in output
    assert raw["api_key"] == "public-test-key"
    assert _redact({"token": "x"}, ()) == {"token": "[REDACTED]"}
    assert Path(tmp_path / "sample.json").exists()
