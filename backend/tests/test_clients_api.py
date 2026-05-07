import pytest
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
        return RiskAlert(level="none", signals=[], summary="")


def test_clients_endpoint_returns_200(tmp_path) -> None:
    client = TestClient(
        create_app(
            data_dir=tmp_path,
            analyzer=FakeAnalyzer(),
            interpreter=FakeInterpreter(),
            risk_service=FakeRiskScreeningService(),
        )
    )
    response = client.get("/api/clients")
    assert response.status_code == 200
    assert response.json() == []


def test_create_client_and_list_it(tmp_path) -> None:
    client = TestClient(
        create_app(
            data_dir=tmp_path,
            analyzer=FakeAnalyzer(),
            interpreter=FakeInterpreter(),
            risk_service=FakeRiskScreeningService(),
        )
    )
    create_response = client.post(
        "/api/clients",
        json={"alias": "Client 001"},
    )
    assert create_response.status_code == 201
    assert create_response.json() == {
        "client_code": "client_001",
        "alias": "Client 001",
        "status": "待初评",
    }

    list_response = client.get("/api/clients")
    assert list_response.status_code == 200
    assert list_response.json() == [
        {
            "client_code": "client_001",
            "alias": "Client 001",
            "status": "待初评",
        }
    ]


def test_create_client_assigns_next_available_code(tmp_path) -> None:
    client = TestClient(
        create_app(
            data_dir=tmp_path,
            analyzer=FakeAnalyzer(),
            interpreter=FakeInterpreter(),
            risk_service=FakeRiskScreeningService(),
        )
    )

    first_response = client.post("/api/clients", json={"alias": "Client 001"})
    second_response = client.post("/api/clients", json={"alias": "Client 002"})

    assert first_response.status_code == 201
    assert second_response.status_code == 201
    assert first_response.json()["client_code"] == "client_001"
    assert second_response.json()["client_code"] == "client_002"
    assert first_response.json()["status"] == "待初评"
    assert second_response.json()["status"] == "待初评"


def test_update_client_status(tmp_path) -> None:
    client = TestClient(
        create_app(
            data_dir=tmp_path,
            analyzer=FakeAnalyzer(),
            interpreter=FakeInterpreter(),
            risk_service=FakeRiskScreeningService(),
        )
    )

    create_response = client.post("/api/clients", json={"alias": "Client 001"})
    assert create_response.status_code == 201

    update_response = client.patch(
        "/api/clients/client_001",
        json={"status": "需风险复核"},
    )

    assert update_response.status_code == 200
    assert update_response.json() == {
        "client_code": "client_001",
        "alias": "Client 001",
        "status": "需风险复核",
    }

    list_response = client.get("/api/clients")
    assert list_response.status_code == 200
    assert list_response.json() == [
        {
            "client_code": "client_001",
            "alias": "Client 001",
            "status": "需风险复核",
        }
    ]


def test_create_app_rejects_disallowed_ai_gateway(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "https://x666.me")
    monkeypatch.setenv("ANTHROPIC_MODEL", "gpt-5.4")

    with pytest.raises(RuntimeError, match="x666.me"):
        create_app()


def test_health_endpoint_reports_provider_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "https://api.deepseek.com/anthropic")
    monkeypatch.setenv("ANTHROPIC_MODEL", "deepseek-v4-pro")

    client = TestClient(create_app())
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "ai_provider": {
            "base_url": "https://api.deepseek.com/anthropic",
            "model": "deepseek-v4-pro",
            "api_key_configured": True,
            "uses_default_services": True,
        },
    }
