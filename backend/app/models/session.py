from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from pydantic import BaseModel, Field, model_validator


ColorChoice = str


def utc_timestamp() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H-%M-%SZ")


class StructuredAnalysis(BaseModel):
    emotion_labels: list[str] = Field(default_factory=list)
    intensity: str = ""
    cognitive_patterns: list[str] = Field(default_factory=list)
    emotion_target: str = ""
    confidence: float = 0.0
    risk_level: str = "none"


class RiskAlert(BaseModel):
    level: str = "none"
    signals: list[str] = Field(default_factory=list)
    summary: str = ""


class AnnotationFeedback(BaseModel):
    notes: str = ""
    notes_color: ColorChoice = "black"
    rating: int | None = None
    disagreements: dict[str, str] = Field(default_factory=dict)
    disagreement_colors: dict[str, ColorChoice] = Field(default_factory=dict)


class RebtWorksheet(BaseModel):
    activating_event: str = ""
    belief: str = ""
    consequence: str = ""
    dispute: str = ""
    effective_belief: str = ""
    homework: str = ""
    follow_up: str = ""


class RebtPlanItem(BaseModel):
    title: str
    detail: str
    source_quote: str = ""


class RebtLineInterpretation(BaseModel):
    source_quote: str
    rebt_step: str = ""
    activating_event: str = ""
    belief: str = ""
    consequence: str = ""
    dispute_direction: str = ""
    intervention_question: str = ""
    risk_note: str = ""


class RebtPlan(BaseModel):
    line_interpretations: list[RebtLineInterpretation] = Field(default_factory=list)
    items: list[RebtPlanItem] = Field(default_factory=list)
    worksheet_draft: RebtWorksheet = Field(default_factory=RebtWorksheet)


class SessionRecord(BaseModel):
    session_id: str
    client_code: str
    created_at: str
    updated_at: str = ""
    source_text: str
    analysis: StructuredAnalysis | None = None
    risk_alert: RiskAlert | None = None
    interpretation: str = ""
    rebt_plan: RebtPlan = Field(default_factory=RebtPlan)
    feedback: AnnotationFeedback = Field(default_factory=AnnotationFeedback)
    rebt_worksheet: RebtWorksheet = Field(default_factory=RebtWorksheet)

    @model_validator(mode="after")
    def ensure_updated_at(self) -> "SessionRecord":
        if not self.updated_at:
            self.updated_at = self.created_at
        return self

    @classmethod
    def build_initial(cls, client_code: str, source_text: str) -> "SessionRecord":
        timestamp = utc_timestamp()
        return cls(
            session_id=uuid4().hex,
            client_code=client_code,
            created_at=timestamp,
            updated_at=timestamp,
            source_text=source_text,
        )

    @classmethod
    def create_completed(
        cls,
        *,
        client_code: str,
        source_text: str,
        analysis: StructuredAnalysis,
        interpretation: str,
        rebt_plan: RebtPlan | None = None,
        risk_alert: RiskAlert | None = None,
    ) -> "SessionRecord":
        session = cls.build_initial(client_code=client_code, source_text=source_text)
        session.analysis = analysis
        session.interpretation = interpretation
        session.rebt_plan = rebt_plan or RebtPlan()
        session.risk_alert = risk_alert
        return session


class AnalyzeSessionRequest(BaseModel):
    client_code: str
    source_text: str


class SessionSummary(BaseModel):
    session_id: str
    created_at: str
    updated_at: str = ""
    source_text: str
    emotion_labels: list[str] = Field(default_factory=list)
    intensity: str = ""
    cognitive_patterns: list[str] = Field(default_factory=list)
    risk_level: str = "none"
    has_rebt_worksheet: bool = False

    @model_validator(mode="after")
    def ensure_updated_at(self) -> "SessionSummary":
        if not self.updated_at:
            self.updated_at = self.created_at
        return self
