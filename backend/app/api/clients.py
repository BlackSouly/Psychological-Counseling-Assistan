from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.models.client import ClientProfile, CreateClientRequest, UpdateClientStatusRequest
from app.models.session import SessionSummary
from app.services.storage import JsonStorage

router = APIRouter()


def get_storage() -> JsonStorage:
    raise RuntimeError("Storage dependency not configured.")


StorageDep = Annotated[JsonStorage, Depends(get_storage)]


@router.get("/clients", response_model=list[ClientProfile])
def list_clients(storage: StorageDep) -> list[ClientProfile]:
    return storage.list_clients()


@router.post("/clients", response_model=ClientProfile, status_code=201)
def create_client(payload: CreateClientRequest, storage: StorageDep) -> ClientProfile:
    client = ClientProfile(
        client_code=storage.allocate_next_client_code(),
        alias=payload.alias,
    )
    storage.save_client(client)
    return client


@router.patch("/clients/{client_code}", response_model=ClientProfile)
def update_client_status(
    client_code: str,
    payload: UpdateClientStatusRequest,
    storage: StorageDep,
) -> ClientProfile:
    try:
        existing_client = storage.get_client(client_code)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    updated_client = existing_client.model_copy(update={"status": payload.status})
    storage.save_client(updated_client)
    return updated_client


@router.get("/clients/{client_code}/sessions", response_model=list[SessionSummary])
def list_client_sessions(client_code: str, storage: StorageDep) -> list[SessionSummary]:
    return storage.list_session_summaries(client_code)
