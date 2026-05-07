from typing import Literal

from pydantic import BaseModel, Field


ClientStatus = Literal["待初评", "跟进中", "需风险复核", "已稳定", "已结案"]


class ClientProfile(BaseModel):
    client_code: str = Field(pattern=r"^client_[0-9]{3,}$")
    alias: str
    status: ClientStatus = "待初评"


class CreateClientRequest(BaseModel):
    alias: str = Field(min_length=1)


class UpdateClientStatusRequest(BaseModel):
    status: ClientStatus
