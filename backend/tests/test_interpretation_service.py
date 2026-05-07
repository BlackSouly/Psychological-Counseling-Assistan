from __future__ import annotations

import pytest

from app.models.session import StructuredAnalysis
from app.services.interpretation import AnthropicRebtInterpreter


class DummyResponse:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


def test_interpretation_raises_when_model_response_is_truncated(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_post(*args, **kwargs) -> DummyResponse:
        return DummyResponse(
            {
                "content": [{"type": "text", "text": "partial interpretation"}],
                "stop_reason": "max_tokens",
            }
        )

    monkeypatch.setattr("app.services.interpretation.httpx.post", fake_post)

    interpreter = AnthropicRebtInterpreter("test-key", base_url="https://example.com", model="test-model")
    analysis = StructuredAnalysis(
        emotion_labels=["anxiety"],
        intensity="high",
        cognitive_patterns=["catastrophizing"],
        emotion_target="self",
        confidence=0.9,
        risk_level="review",
    )

    with pytest.raises(RuntimeError, match="truncated"):
        interpreter.interpret("sample text", analysis)


def test_interpretation_prompt_requests_structured_detailed_chinese_output(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured_prompt: dict[str, str] = {}

    def fake_post(*args, **kwargs) -> DummyResponse:
        captured_prompt["content"] = kwargs["json"]["messages"][0]["content"]
        return DummyResponse(
            {
                "content": [{"type": "text", "text": "一、核心观察：...\n二、可能信念：...\n三、风险提示：...\n四、干预建议：..."}],
                "stop_reason": "end_turn",
            }
        )

    monkeypatch.setattr("app.services.interpretation.httpx.post", fake_post)

    interpreter = AnthropicRebtInterpreter("test-key", base_url="https://example.com", model="test-model")
    analysis = StructuredAnalysis(
        emotion_labels=["焦虑"],
        intensity="高",
        cognitive_patterns=["灾难化思维"],
        emotion_target="自身",
        confidence=0.9,
        risk_level="review",
    )

    interpreter.interpret("sample text", analysis)

    assert "Write in Chinese" not in captured_prompt["content"]
    assert "结构化详细" in captured_prompt["content"]
    assert "核心观察" in captured_prompt["content"]
    assert "可能信念" in captured_prompt["content"]
    assert "风险提示" in captured_prompt["content"]
    assert "干预建议" in captured_prompt["content"]
