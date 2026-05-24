from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.models.session import AnalyzeSessionRequest, AnnotationFeedback, RebtWorksheet, SessionRecord
from app.services.analysis import StructuredAnalyzer
from app.services.interpretation import RebtInterpreter
from app.services.risk import RiskScreeningService
from app.services.storage import JsonStorage

router = APIRouter()


@dataclass
class SessionServices:
    storage: JsonStorage
    analyzer: StructuredAnalyzer
    interpreter: RebtInterpreter
    risk_service: RiskScreeningService


def get_session_services() -> SessionServices:
    raise RuntimeError("Session services dependency not configured.")


SessionServicesDep = Annotated[SessionServices, Depends(get_session_services)]


@router.post("/sessions/analyze", response_model=SessionRecord, status_code=201)
def analyze_session(payload: AnalyzeSessionRequest, services: SessionServicesDep) -> SessionRecord:
    try:
        risk_alert = services.risk_service.screen(payload.source_text)
        analysis = services.analyzer.analyze(payload.source_text)
        interpretation = services.interpreter.interpret(payload.source_text, analysis)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                f"上游模型服务返回 {exc.response.status_code}，"
                "请检查 DeepSeek/Anthropic API 配置是否有效。"
            ),
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail="无法连接到上游模型服务，请稍后重试。",
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    session = SessionRecord.create_completed(
        client_code=payload.client_code,
        source_text=payload.source_text,
        analysis=analysis,
        interpretation=interpretation,
        risk_alert=risk_alert,
    )
    services.storage.save_session(session)
    return session


@router.get("/sessions/{session_id}", response_model=SessionRecord)
def get_session(session_id: str, services: SessionServicesDep) -> SessionRecord:
    try:
        return services.storage.get_session(session_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/sessions/{session_id}/feedback", response_model=SessionRecord)
def update_feedback(
    session_id: str,
    payload: AnnotationFeedback,
    services: SessionServicesDep,
) -> SessionRecord:
    try:
        session = services.storage.get_session(session_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    updated = session.model_copy(update={"feedback": payload})
    services.storage.save_session(updated)
    return updated


@router.patch("/sessions/{session_id}/worksheet", response_model=SessionRecord)
def update_worksheet(
    session_id: str,
    payload: RebtWorksheet,
    services: SessionServicesDep,
) -> SessionRecord:
    try:
        session = services.storage.get_session(session_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    updated = session.model_copy(update={"rebt_worksheet": payload})
    services.storage.save_session(updated)
    return updated
