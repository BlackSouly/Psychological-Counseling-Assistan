from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI

from app.api import clients, sessions
from app.config import DATA_DIR, ProviderConfig, get_provider_config, validate_provider_config
from app.services.analysis import StructuredAnalyzer, build_default_analyzer
from app.services.interpretation import RebtInterpreter, build_default_interpreter
from app.services.risk import RiskScreeningService, build_default_risk_service
from app.services.storage import JsonStorage


def build_provider_health(
    provider_config: ProviderConfig,
    *,
    uses_default_services: bool,
) -> dict[str, object]:
    return {
        "base_url": provider_config.base_url,
        "model": provider_config.model,
        "api_key_configured": bool(provider_config.api_key),
        "uses_default_services": uses_default_services,
    }


def create_app(
    data_dir: Path | None = None,
    *,
    analyzer: StructuredAnalyzer | None = None,
    interpreter: RebtInterpreter | None = None,
    risk_service: RiskScreeningService | None = None,
) -> FastAPI:
    uses_default_services = any(service is None for service in (analyzer, interpreter, risk_service))
    provider_config = get_provider_config()
    if uses_default_services:
        validate_provider_config(provider_config)

    app = FastAPI(title="Psychological Analysis Assistant")
    storage = JsonStorage(data_dir or DATA_DIR)
    session_analyzer = analyzer or build_default_analyzer()
    session_interpreter = interpreter or build_default_interpreter()
    session_risk_service = risk_service or build_default_risk_service()
    app.state.provider_health = build_provider_health(
        provider_config,
        uses_default_services=uses_default_services,
    )

    app.dependency_overrides[clients.get_storage] = lambda: storage
    app.dependency_overrides[sessions.get_session_services] = lambda: sessions.SessionServices(
        storage=storage,
        analyzer=session_analyzer,
        interpreter=session_interpreter,
        risk_service=session_risk_service,
    )
    app.include_router(clients.router, prefix="/api")
    app.include_router(sessions.router, prefix="/api")

    @app.get("/api/health")
    def health() -> dict[str, object]:
        return {
            "status": "ok",
            "ai_provider": app.state.provider_health,
        }

    return app
