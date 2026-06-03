from __future__ import annotations

import pytest

import json

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
    captured_request: dict[str, object] = {}

    def fake_post(*args, **kwargs) -> DummyResponse:
        captured_request["content"] = kwargs["json"]["messages"][0]["content"]
        captured_request["max_tokens"] = kwargs["json"]["max_tokens"]
        captured_request["timeout"] = kwargs["timeout"]
        return DummyResponse(
            {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(
                            {
                                "interpretation": "一、核心概念化\n...\n二、维持机制\n...\n三、风险与边界\n...\n四、干预优先级\n...",
                                "rebt_plan": {
                                    "line_interpretations": [
                                        {
                                            "source_quote": "sample text",
                                            "rebt_step": "B 信念",
                                            "activating_event": "听到 sample text 时被触发。",
                                            "belief": "事情必须按预期发展。",
                                            "consequence": "焦虑升高并回避确认。",
                                            "dispute_direction": "检验失控是否必然等于灾难。",
                                            "intervention_question": "这句话里最让你担心的后果是什么？",
                                            "risk_note": "需要确认是否伴随失眠或功能下降。",
                                        }
                                    ],
                                    "items": [
                                        {
                                            "title": "澄清具体触发",
                                            "detail": "围绕原文中的 sample text 具体化触发事件。",
                                            "source_quote": "sample text",
                                        }
                                    ],
                                    "worksheet_draft": {
                                        "activating_event": "sample text 相关触发事件",
                                        "belief": "事情必须受控。",
                                        "consequence": "焦虑与回避。",
                                        "dispute": "失控一定会导致最坏结果吗？",
                                        "effective_belief": "我希望可控，但也能处理意外。",
                                        "homework": "记录一次担忧并区分可控/不可控。",
                                        "follow_up": "下次复盘担忧强度是否下降。",
                                    },
                                },
                            },
                            ensure_ascii=False,
                        ),
                    }
                ],
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

    result = interpreter.interpret("sample text", analysis)

    prompt = str(captured_request["content"])
    assert "Write in Chinese" not in prompt
    assert "合法 JSON" in prompt
    assert "结构化详细" in prompt
    assert "核心概念化" in prompt
    assert "维持机制" in prompt
    assert "风险与边界" in prompt
    assert "干预优先级" in prompt
    assert "不要逐句展开关键句" in prompt
    assert "整体 REBT 概念化" in prompt
    assert "中心非理性信念" in prompt
    assert "自我价值绑定方式" in prompt
    assert "工作假设" in prompt
    assert "确认偏差" in prompt
    assert "不宜过早挑战" in prompt
    assert "关键句逐句解读" in prompt
    assert "不要在 interpretation 中逐句展开" in prompt
    assert "不要限制总字数" in prompt
    assert "line_interpretations" in prompt
    assert "worksheet_draft" in prompt
    assert "3 到 8 个最重要的原文片段" in prompt
    assert "A-B-C 链条" in prompt
    assert "A 触发事件" in prompt
    assert "D 辩论" in prompt
    assert "E 新信念" in prompt
    assert "rebt_plan.worksheet_draft" in prompt
    assert "咨询师下一步可以直接使用" in prompt
    assert "非理性信念" in prompt
    assert "不得重复同一种干预动作" in prompt
    assert "安全评估" in prompt
    assert "source_quote 必须引用原始文本中的短片段" in prompt
    assert captured_request["max_tokens"] == 5000
    assert captured_request["timeout"] == 90.0
    assert result.rebt_plan.line_interpretations[0].belief == "事情必须按预期发展。"
    assert result.rebt_plan.items[0].source_quote == "sample text"
    assert result.rebt_plan.worksheet_draft.dispute == "失控一定会导致最坏结果吗？"


def test_interpretation_raises_when_model_response_does_not_match_schema(
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
                                "interpretation": "only interpretation",
                                "rebt_plan": {"items": [{"title": "missing detail"}]},
                            },
                            ensure_ascii=False,
                        ),
                    }
                ],
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

    with pytest.raises(RuntimeError, match="expected JSON schema"):
        interpreter.interpret("sample text", analysis)


def test_interpretation_raises_when_model_response_uses_legacy_sections(
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
                                "interpretation": (
                                    "一、核心观察\n...\n二、关键句逐句解读\n...\n三、可能信念链条\n...\n四、风险提示\n..."
                                ),
                                "rebt_plan": {
                                    "items": [
                                        {
                                            "title": "澄清具体触发",
                                            "detail": "围绕原文中的 sample text 具体化触发事件。",
                                            "source_quote": "sample text",
                                        }
                                    ]
                                },
                            },
                            ensure_ascii=False,
                        ),
                    }
                ],
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

    with pytest.raises(RuntimeError, match="required REBT interpretation structure"):
        interpreter.interpret("sample text", analysis)
