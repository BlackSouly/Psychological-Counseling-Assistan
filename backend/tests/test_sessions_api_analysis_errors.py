from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app
from app.models.session import RiskAlert, StructuredAnalysis
from app.services.interpretation import RebtInterpretationResult


class InvalidAnalyzer:
    def analyze(self, text: str) -> StructuredAnalysis:
        raise RuntimeError("Analysis response did not match the expected JSON schema.")


class FakeInterpreter:
    def interpret(self, text: str, analysis: StructuredAnalysis) -> RebtInterpretationResult:
        raise AssertionError("Interpreter should not be called when analysis fails.")


class InvalidInterpretationStructure:
    def interpret(self, text: str, analysis: StructuredAnalysis) -> RebtInterpretationResult:
        raise RuntimeError("Interpretation response did not match the required REBT interpretation structure.")


class FakeAnalyzer:
    def analyze(self, text: str) -> StructuredAnalysis:
        return StructuredAnalysis(
            emotion_labels=["anxiety"],
            intensity="high",
            cognitive_patterns=["catastrophizing"],
            emotion_target="self",
            confidence=0.9,
            risk_level="review",
        )


class FakeRiskScreeningService:
    def screen(self, text: str) -> RiskAlert:
        return RiskAlert(level="none", signals=[], summary="")


def test_analyze_text_returns_503_when_analysis_schema_is_invalid(tmp_path) -> None:
    client = TestClient(
        create_app(
            data_dir=tmp_path,
            analyzer=InvalidAnalyzer(),
            interpreter=FakeInterpreter(),
            risk_service=FakeRiskScreeningService(),
        )
    )
    client.post(
        "/api/clients",
        json={"client_code": "client_001", "alias": "client 001"},
    )

    response = client.post(
        "/api/sessions/analyze",
        json={"client_code": "client_001", "source_text": "I failed again."},
    )

    assert response.status_code == 503
    assert "结构化分析结果" in response.json()["detail"]


def test_analyze_text_returns_503_when_rebt_interpretation_structure_is_invalid(tmp_path) -> None:
    client = TestClient(
        create_app(
            data_dir=tmp_path,
            analyzer=FakeAnalyzer(),
            interpreter=InvalidInterpretationStructure(),
            risk_service=FakeRiskScreeningService(),
        )
    )
    client.post(
        "/api/clients",
        json={"client_code": "client_001", "alias": "client 001"},
    )

    response = client.post(
        "/api/sessions/analyze",
        json={"client_code": "client_001", "source_text": "I failed again."},
    )

    assert response.status_code == 503
    assert "四段式" in response.json()["detail"]
