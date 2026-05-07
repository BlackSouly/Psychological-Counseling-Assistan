from __future__ import annotations

import json
from typing import Protocol

import httpx

from app.config import get_provider_config
from app.models.session import RiskAlert


class RiskScreeningService(Protocol):
    def screen(self, text: str) -> RiskAlert: ...


class AnthropicRiskScreeningService:
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

    def screen(self, text: str) -> RiskAlert:
        prompt = (
            "你是一个给专业心理工作者使用的风险筛查服务。"
            "只返回合法 JSON，不要返回 markdown、解释或额外文本。"
            "JSON 必须包含 level, signals, summary 这 3 个字段。"
            "其中：level 只能是 none / review / urgent；"
            "signals 必须是中文字符串数组；"
            "summary 必须是中文字符串，简洁说明为什么需要风险复核。"
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
                "max_tokens": 300,
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
        return RiskAlert.model_validate(json.loads(text_output))


class UnconfiguredRiskScreeningService:
    def screen(self, text: str) -> RiskAlert:
        raise RuntimeError("Risk screening service is not configured.")


def build_default_risk_service() -> RiskScreeningService:
    provider_config = get_provider_config()
    if not provider_config.api_key:
        return UnconfiguredRiskScreeningService()
    return AnthropicRiskScreeningService(
        provider_config.api_key,
        base_url=provider_config.base_url,
        model=provider_config.model,
    )
