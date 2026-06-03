from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.models.session import (
    AnalyzeSessionRequest,
    AnnotationFeedback,
    RebtWorksheet,
    SessionRecord,
    utc_timestamp,
)
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


def translate_session_runtime_error(exc: RuntimeError) -> str:
    message = str(exc)
    if message == "Analysis response did not match the expected JSON schema.":
        return "模型返回的结构化分析结果不完整，请重试生成。"
    if message == "Analysis response was truncated by the model token limit.":
        return "模型输出被截断，未能生成完整的结构化分析结果，请重试。"
    if message == "Analysis response did not contain displayable text.":
        return "模型没有返回可解析的结构化分析结果，请重试。"
    if message == "Interpretation response did not match the expected JSON schema.":
        return "模型返回的 REBT 结构化结果不完整，请重试生成。"
    if message == "Interpretation response was truncated by the model token limit.":
        return "模型输出被截断，未能生成完整的 REBT 结构化结果，请重试。"
    if message == "Interpretation response did not contain displayable text.":
        return "模型没有返回可解析的 REBT 结果，请重试。"
    if message == "Interpretation response did not match the required REBT interpretation structure.":
        return "模型返回的 REBT 解读结构不符合四段式要求，请重新生成。"
    return message


def model_status_error(exc: httpx.HTTPStatusError) -> HTTPException:
    return HTTPException(
        status_code=502,
        detail=f"上游模型服务返回 {exc.response.status_code}，请检查 DeepSeek/Anthropic API 配置是否有效。",
    )


def model_request_error(exc: httpx.RequestError) -> HTTPException:
    return HTTPException(
        status_code=503,
        detail="无法连接到上游模型服务，请稍后重试。",
    )


@router.post("/sessions/analyze", response_model=SessionRecord, status_code=201)
def analyze_session(payload: AnalyzeSessionRequest, services: SessionServicesDep) -> SessionRecord:
    try:
        risk_alert = services.risk_service.screen(payload.source_text)
        analysis = services.analyzer.analyze(payload.source_text)
        interpretation_result = services.interpreter.interpret(payload.source_text, analysis)
    except httpx.HTTPStatusError as exc:
        raise model_status_error(exc) from exc
    except httpx.RequestError as exc:
        raise model_request_error(exc) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=translate_session_runtime_error(exc)) from exc

    session = SessionRecord.create_completed(
        client_code=payload.client_code,
        source_text=payload.source_text,
        analysis=analysis,
        interpretation=interpretation_result.interpretation,
        rebt_plan=interpretation_result.rebt_plan,
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


@router.post("/sessions/{session_id}/rebt-plan", response_model=SessionRecord)
def regenerate_rebt_plan(session_id: str, services: SessionServicesDep) -> SessionRecord:
    try:
        session = services.storage.get_session(session_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if session.analysis is None:
        raise HTTPException(status_code=409, detail="当前记录尚无结构化分析结果，无法补生成 REBT 计划。")

    try:
        interpretation_result = services.interpreter.interpret(session.source_text, session.analysis)
    except httpx.HTTPStatusError as exc:
        raise model_status_error(exc) from exc
    except httpx.RequestError as exc:
        raise model_request_error(exc) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=translate_session_runtime_error(exc)) from exc

    updated = session.model_copy(
        update={
            "interpretation": interpretation_result.interpretation,
            "rebt_plan": interpretation_result.rebt_plan,
            "updated_at": utc_timestamp(),
        }
    )
    services.storage.save_session(updated)
    return updated


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

    updated = session.model_copy(update={"feedback": payload, "updated_at": utc_timestamp()})
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

    updated = session.model_copy(update={"rebt_worksheet": payload, "updated_at": utc_timestamp()})
    services.storage.save_session(updated)
    return updated
