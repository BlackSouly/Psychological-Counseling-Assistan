from __future__ import annotations

from typing import Protocol

import httpx
from pydantic import BaseModel, ValidationError

from app.config import get_provider_config
from app.models.session import RebtPlan, StructuredAnalysis


class RebtInterpretationResult(BaseModel):
    interpretation: str
    rebt_plan: RebtPlan


class RebtInterpreter(Protocol):
    def interpret(self, text: str, analysis: StructuredAnalysis) -> RebtInterpretationResult: ...


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

    def interpret(self, text: str, analysis: StructuredAnalysis) -> RebtInterpretationResult:
        prompt = (
            "你正在为专业心理工作者生成基于 REBT 视角的辅助解读和细化干预计划。"
            "不要给出诊断，不要使用 markdown，不要输出与任务无关的内容。"
            "必须直接输出合法 JSON，不要包裹代码块。JSON 结构必须严格为："
            "{"
            '"interpretation":"一、核心观察\\n...\\n二、可能信念\\n...\\n三、风险提示\\n...\\n四、干预建议\\n...",'
            '"rebt_plan":{"items":[{"title":"...","detail":"...","source_quote":"..."}]}'
            "}"
            "interpretation 必须为中文结构化详细版本，严格包含四个小节：一、核心观察；二、可能信念；三、风险提示；四、干预建议。"
            "每个小节一到三句话，整体控制在 450 到 700 个中文字符之间。"
            "rebt_plan.items 必须包含 5 到 7 条具体干预建议，每条必须针对原始文本或结构化分析中的具体信息。"
            "每条 item 的 title 用简短中文概括干预靶点；detail 写出可执行的会谈操作、提问或练习，不得是通用模板；"
            "source_quote 必须引用原始文本中的短片段；如果原文没有可引用片段，则写空字符串。"
            "风险提示应与当前文本和结构化分析一致，避免夸大。"
            "所有内容都应写成适合专业人员快速阅读和继续判断的辅助说明。"
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
                "max_tokens": 2200,
                "temperature": 0,
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
        try:
            return RebtInterpretationResult.model_validate_json(text_output)
        except ValidationError as exc:
            raise RuntimeError("Interpretation response did not match the expected JSON schema.") from exc


class UnconfiguredRebtInterpreter:
    def interpret(self, text: str, analysis: StructuredAnalysis) -> RebtInterpretationResult:
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
