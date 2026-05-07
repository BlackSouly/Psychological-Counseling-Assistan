from __future__ import annotations

import json
from typing import Protocol

import httpx

from app.config import get_provider_config
from app.models.session import StructuredAnalysis


class StructuredAnalyzer(Protocol):
    def analyze(self, text: str) -> StructuredAnalysis: ...


class AnthropicStructuredAnalyzer:
    def __init__(
        self,
        api_key: str,
        *,
        base_url: str,
        model: str,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model

    def analyze(self, text: str) -> StructuredAnalysis:
        prompt = (
            "你是一个给专业心理工作者使用的文本分析服务。"
            "只返回合法 JSON，不要返回 markdown、解释或额外文本。"
            "JSON 必须包含 emotion_labels, intensity, cognitive_patterns, emotion_target, confidence, risk_level 这 6 个字段。"
            "其中：emotion_labels 和 cognitive_patterns 必须是中文字符串数组；"
            "intensity 必须是字符串，只能是 低 / 中 / 高 / 极高 之一；"
            "emotion_target 必须是中文字符串，只能是 自身 / 他人 / 情境 / 混合 / 未知 之一；"
            "confidence 必须是 0 到 1 之间的浮点数；"
            "risk_level 必须是字符串，只能是 none / review / urgent 之一。"
            "\n\n文本：\n"
            f"{text}"
        )
        response = httpx.post(
            f"{self.base_url}/v1/messages",
            headers={
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": self.model,
                "max_tokens": 500,
                "thinking": {"type": "disabled"},
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=30.0,
        )
        response.raise_for_status()
        payload = response.json()
        text_output = "".join(
            block["text"] for block in payload.get("content", []) if block.get("type") == "text"
        )
        return StructuredAnalysis.model_validate(json.loads(text_output))


class UnconfiguredStructuredAnalyzer:
    def analyze(self, text: str) -> StructuredAnalysis:
        raise RuntimeError("Structured analyzer is not configured.")


def build_default_analyzer() -> StructuredAnalyzer:
    provider_config = get_provider_config()
    if not provider_config.api_key:
        return UnconfiguredStructuredAnalyzer()
    return AnthropicStructuredAnalyzer(
        provider_config.api_key,
        base_url=provider_config.base_url,
        model=provider_config.model,
    )
