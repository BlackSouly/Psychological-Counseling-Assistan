from __future__ import annotations

from typing import Protocol

import httpx
from pydantic import BaseModel, ValidationError

from app.config import get_provider_config
from app.models.session import RebtPlan, StructuredAnalysis


class RebtInterpretationResult(BaseModel):
    interpretation: str
    rebt_plan: RebtPlan


REQUIRED_INTERPRETATION_SECTIONS = (
    "一、核心概念化",
    "二、维持机制",
    "三、风险与边界",
    "四、干预优先级",
)

FORBIDDEN_INTERPRETATION_SECTIONS = (
    "关键句逐句解读",
    "可能信念链条",
)


def validate_interpretation_contract(result: RebtInterpretationResult) -> None:
    missing_sections = [
        section for section in REQUIRED_INTERPRETATION_SECTIONS if section not in result.interpretation
    ]
    forbidden_sections = [
        section for section in FORBIDDEN_INTERPRETATION_SECTIONS if section in result.interpretation
    ]
    if missing_sections or forbidden_sections:
        raise RuntimeError("Interpretation response did not match the required REBT interpretation structure.")


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
            '"interpretation":"一、核心概念化\\n...\\n二、维持机制\\n...\\n三、风险与边界\\n...\\n四、干预优先级\\n...",'
            '"rebt_plan":{'
            '"line_interpretations":[{"source_quote":"...","rebt_step":"...","activating_event":"...","belief":"...","consequence":"...","dispute_direction":"...","intervention_question":"...","risk_note":"..."}],'
            '"items":[{"title":"...","detail":"...","source_quote":"..."}],'
            '"worksheet_draft":{"activating_event":"...","belief":"...","consequence":"...","dispute":"...","effective_belief":"...","homework":"...","follow_up":"..."}'
            "}"
            "}"
            "interpretation 必须为中文结构化详细版本，严格包含四个小节：一、核心概念化；二、维持机制；三、风险与边界；四、干预优先级。"
            "不要限制总字数，优先保证细致、完整和可追溯；但不得重复、空泛或堆砌无关理论。"
            "interpretation 不要逐句展开关键句，也不要重复 rebt_plan.line_interpretations 的内容；它只负责把逐句证据综合成整体 REBT 概念化。"
            "核心概念化必须说明最可能的中心非理性信念、自我价值绑定方式、A-B-C 链条如何在本次文本中形成，并指出哪些判断仍只是工作假设。"
            "维持机制必须说明该信念如何通过情绪、回避、确认偏差、反刍、自责、求证或人际反应被继续强化，并引用少量原文关键词作为依据。"
            "风险与边界必须与当前文本和结构化分析一致，说明哪些内容需要安全评估、督导复核、转介边界或暂缓挑战；避免夸大风险。"
            "干预优先级必须给出会谈顺序：先共情与安全评估，再澄清 A-B-C 链条，再进入 D 辩论，最后形成 E 新信念和家庭练习；同时说明哪些信念不宜过早挑战。"
            "关键句逐句解读只写入 rebt_plan.line_interpretations，不要在 interpretation 中逐句展开。"
            "rebt_plan.line_interpretations 必须覆盖 3 到 8 个最重要的原文片段；若原始文本较短，则覆盖所有有临床意义的句子。"
            "rebt_plan.line_interpretations 必须与关键句逐句解读对应，每条都必须直接引用原始文本片段，并说明该片段对应 A/B/C/D/E 中的哪一环或哪几环。"
            "line_interpretations 中 activating_event、belief、consequence、dispute_direction、intervention_question 必须围绕该 source_quote 分别填写；不能用同一套文字复制到多条。"
            "risk_note 只写与该句相关的风险、复核或边界信息；如无相关风险则写空字符串。"
            "rebt_plan.items 必须包含 5 到 7 条具体干预建议，每条必须针对原始文本或结构化分析中的具体信息。"
            "每条 item 的 title 用简短中文概括干预靶点，并尽量标明 REBT 环节，例如 A 触发事件、B 信念、C 后果、D 辩论、E 新信念或家庭练习。"
            "每条 item 的 detail 必须包含三部分：1）为什么针对这条原文或分析结果；2）咨询师下一步可以直接使用的一到两个具体提问、回应或练习；3）预期要澄清或松动的非理性信念。"
            "detail 不得只写原则、模板口号或宽泛建议，不得重复同一种干预动作；应体现会谈顺序，例如先共情与安全评估，再澄清 A-B-C 链条，再进入 D/E。"
            "source_quote 必须引用原始文本中的短片段，优先使用来访者原句或原句中的关键词；不得引用结构化分析里的词替代原文。"
            "如果原始文本确实没有可引用片段，则 source_quote 写空字符串，但 detail 仍需说明依据来自哪个结构化分析字段。"
            "rebt_plan.worksheet_draft 必须给出可直接预填到 REBT 工作纸的草案：A 写触发事件候选，B 写可检验的信念假设，C 写情绪/行为后果，D 写辩论问题，E 写替代信念草案，homework 写基于本次文本的练习，follow_up 写下次会谈追踪点。"
            "风险提示应与当前文本和结构化分析一致，避免夸大；如果 risk_level 为 review 或 urgent，干预建议中至少一条必须包含安全评估、督导复核或转介边界。"
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
                "max_tokens": 5000,
                "temperature": 0,
                "thinking": {"type": "disabled"},
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=90.0,
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
            result = RebtInterpretationResult.model_validate_json(text_output)
        except ValidationError as exc:
            raise RuntimeError("Interpretation response did not match the expected JSON schema.") from exc
        validate_interpretation_contract(result)
        return result


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
