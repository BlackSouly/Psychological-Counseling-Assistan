from __future__ import annotations

from typing import Protocol

import httpx

from app.config import get_provider_config
from app.models.session import StructuredAnalysis


class RebtInterpreter(Protocol):
    def interpret(self, text: str, analysis: StructuredAnalysis) -> str: ...


class AnthropicRebtInterpreter:
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

    def interpret(self, text: str, analysis: StructuredAnalysis) -> str:
        prompt = (
            "你正在为专业心理工作者生成一段基于 REBT 视角的辅助解读。"
            "不要给出诊断，不要使用 markdown 粗体标记，不要输出与任务无关的内容。"
            "请直接使用中文，并且输出为结构化详细版本，严格包含以下四个小节："
            "一、核心观察"
            "二、可能信念"
            "三、风险提示"
            "四、干预建议"
            "每个小节用一到三句话，内容完整、清晰、专业，整体控制在 450 到 700 个中文字符之间。"
            "风险提示应与当前文本和结构化分析一致，避免夸大。"
            "请把这段内容写成适合专业人员快速阅读和继续判断的辅助说明。"
            "\n\n原始文本：\n"
            f"{text}\n\n结构化分析结果：\n{analysis.model_dump_json(indent=2, ensure_ascii=False)}"
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
                "max_tokens": 1400,
                "thinking": {"type": "disabled"},
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=30.0,
        )
        response.raise_for_status()
        payload = response.json()
        text_output = "".join(
            block["text"] for block in payload.get("content", []) if block.get("type") == "text"
        ).strip()
        if payload.get("stop_reason") == "max_tokens":
            raise RuntimeError("Interpretation response was truncated by the model token limit.")
        if not text_output:
            raise RuntimeError("Interpretation response did not contain displayable text.")
        return text_output


class UnconfiguredRebtInterpreter:
    def interpret(self, text: str, analysis: StructuredAnalysis) -> str:
        raise RuntimeError("REBT interpreter is not configured.")


def build_default_interpreter() -> RebtInterpreter:
    provider_config = get_provider_config()
    if not provider_config.api_key:
        return UnconfiguredRebtInterpreter()
    return AnthropicRebtInterpreter(
        provider_config.api_key,
        base_url=provider_config.base_url,
        model=provider_config.model,
    )
