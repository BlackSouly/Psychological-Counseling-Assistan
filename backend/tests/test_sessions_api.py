from fastapi.testclient import TestClient

from app.main import create_app
from app.models.session import RiskAlert, StructuredAnalysis


class FakeAnalyzer:
    def analyze(self, text: str) -> StructuredAnalysis:
        return StructuredAnalysis(
            emotion_labels=["焦虑"],
            intensity="高",
            cognitive_patterns=["灾难化思维"],
            emotion_target="自身",
            confidence=0.91,
            risk_level="none",
        )


class FakeInterpreter:
    def interpret(self, text: str, analysis: StructuredAnalysis) -> str:
        return "一、核心观察\n这是结构化详细版解读。"


class FakeRiskScreeningService:
    def screen(self, text: str) -> RiskAlert:
        if "不想活" in text:
            return RiskAlert(
                level="urgent",
                signals=["自伤相关表达"],
                summary="需要立即进行专业风险复核。",
            )
        return RiskAlert(level="none", signals=[], summary="")


def test_analyze_text_returns_structured_result_and_interpretation(tmp_path) -> None:
    client = TestClient(
        create_app(
            data_dir=tmp_path,
            analyzer=FakeAnalyzer(),
            interpreter=FakeInterpreter(),
            risk_service=FakeRiskScreeningService(),
        )
    )
    client.post(
        "/api/clients",
        json={"client_code": "client_001", "alias": "来访者 001"},
    )

    response = client.post(
        "/api/sessions/analyze",
        json={
            "client_code": "client_001",
            "source_text": "我最近一直很焦虑，总觉得事情会失控。",
        },
    )
    body = response.json()
    assert response.status_code == 201
    assert body["analysis"]["emotion_labels"]
    assert body["analysis"]["confidence"] >= 0
    assert body["interpretation"]


def test_analysis_response_contains_distinct_risk_alert_channel(tmp_path) -> None:
    client = TestClient(
        create_app(
            data_dir=tmp_path,
            analyzer=FakeAnalyzer(),
            interpreter=FakeInterpreter(),
            risk_service=FakeRiskScreeningService(),
        )
    )
    client.post(
        "/api/clients",
        json={"client_code": "client_001", "alias": "来访者 001"},
    )

    response = client.post(
        "/api/sessions/analyze",
        json={
            "client_code": "client_001",
            "source_text": "我不想活了，觉得没有意义。",
        },
    )
    body = response.json()
    assert response.status_code == 201
    assert "risk_alert" in body
    assert body["risk_alert"]["level"] in {"none", "review", "urgent"}


def test_feedback_patch_updates_notes_rating_colors_and_disagreements(tmp_path) -> None:
    client = TestClient(
        create_app(
            data_dir=tmp_path,
            analyzer=FakeAnalyzer(),
            interpreter=FakeInterpreter(),
            risk_service=FakeRiskScreeningService(),
        )
    )
    client.post(
        "/api/clients",
        json={"client_code": "client_001", "alias": "来访者 001"},
    )

    session = client.post(
        "/api/sessions/analyze",
        json={"client_code": "client_001", "source_text": "我最近非常烦躁。"},
    ).json()

    response = client.patch(
        f"/api/sessions/{session['session_id']}/feedback",
        json={
            "notes": "情绪识别基本准确，但认知模式偏差较大。",
            "notes_color": "red",
            "rating": 82,
            "disagreements": {"cognitive_patterns": "需要弱化灾难化程度"},
            "disagreement_colors": {"cognitive_patterns": "blue"},
        },
    )
    body = response.json()
    assert response.status_code == 200
    assert body["feedback"]["rating"] == 82
    assert body["feedback"]["notes_color"] == "red"
    assert body["feedback"]["disagreement_colors"]["cognitive_patterns"] == "blue"
    assert body["analysis"] == session["analysis"]


def test_worksheet_patch_persists_rebt_workflow_fields(tmp_path) -> None:
    client = TestClient(
        create_app(
            data_dir=tmp_path,
            analyzer=FakeAnalyzer(),
            interpreter=FakeInterpreter(),
            risk_service=FakeRiskScreeningService(),
        )
    )
    client.post(
        "/api/clients",
        json={"client_code": "client_001", "alias": "client 001"},
    )

    session = client.post(
        "/api/sessions/analyze",
        json={"client_code": "client_001", "source_text": "I failed again."},
    ).json()

    worksheet = {
        "activating_event": "A event",
        "belief": "B belief",
        "consequence": "C consequence",
        "dispute": "D dispute",
        "effective_belief": "E belief",
        "homework": "Homework",
        "follow_up": "Follow up",
    }
    response = client.patch(
        f"/api/sessions/{session['session_id']}/worksheet",
        json=worksheet,
    )

    assert response.status_code == 200
    assert response.json()["rebt_worksheet"] == worksheet

    detail = client.get(f"/api/sessions/{session['session_id']}")
    assert detail.status_code == 200
    assert detail.json()["rebt_worksheet"] == worksheet
