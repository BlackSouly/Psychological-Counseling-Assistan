from __future__ import annotations

import json

import pytest

from app.services.analysis import AnthropicStructuredAnalyzer


class DummyResponse:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


def test_analysis_raises_when_model_response_is_truncated(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_post(*args, **kwargs) -> DummyResponse:
        return DummyResponse(
            {
                "content": [{"type": "text", "text": '{"emotion_labels":["焦虑"]}'}],
                "stop_reason": "max_tokens",
            }
        )

    monkeypatch.setattr("app.services.analysis.httpx.post", fake_post)

    analyzer = AnthropicStructuredAnalyzer("test-key", base_url="https://example.com", model="test-model")

    with pytest.raises(RuntimeError, match="truncated"):
        analyzer.analyze("sample text")


def test_analysis_raises_when_model_response_is_not_valid_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_post(*args, **kwargs) -> DummyResponse:
        return DummyResponse(
            {
                "content": [{"type": "text", "text": "not-json"}],
                "stop_reason": "end_turn",
            }
        )

    monkeypatch.setattr("app.services.analysis.httpx.post", fake_post)

    analyzer = AnthropicStructuredAnalyzer("test-key", base_url="https://example.com", model="test-model")

    with pytest.raises(RuntimeError, match="expected JSON schema"):
        analyzer.analyze("sample text")


def test_analysis_raises_when_model_response_does_not_match_schema(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_post(*args, **kwargs) -> DummyResponse:
        return DummyResponse(
            {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(
                            {
                                "emotion_labels": "焦虑",
                                "intensity": "高",
                                "cognitive_patterns": [],
                                "emotion_target": "自身",
                                "confidence": "high",
                                "risk_level": "none",
                            },
                            ensure_ascii=False,
                        ),
                    }
                ],
                "stop_reason": "end_turn",
            }
        )

    monkeypatch.setattr("app.services.analysis.httpx.post", fake_post)

    analyzer = AnthropicStructuredAnalyzer("test-key", base_url="https://example.com", model="test-model")

    with pytest.raises(RuntimeError, match="expected JSON schema"):
        analyzer.analyze("sample text")
