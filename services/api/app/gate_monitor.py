"""Read and validate the Smart Bus Gate audit history from n8n."""

import asyncio
from datetime import datetime, timezone
import logging
import os
from time import monotonic
from typing import Annotated, Literal
from urllib.parse import urlsplit

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import (
    AwareDatetime, BaseModel, Field, FiniteFloat, StrictBool,
    StringConstraints, ValidationError, field_validator, model_validator,
)

router = APIRouter(prefix="/api/rpa")
logger = logging.getLogger(__name__)
MAX_BYTES = 4 * 1024 * 1024
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class GateEvent(BaseModel):
    id: int = Field(strict=True, gt=0)
    dispositivo: Label
    evento: Label
    distancia_cm: FiniteFloat = Field(strict=True)
    movimento: StrictBool
    tipo_registro: Label
    data_hora: AwareDatetime

    @field_validator("data_hora", mode="before")
    @classmethod
    def require_iso_datetime(cls, value):
        if not isinstance(value, str) or "T" not in value:
            raise ValueError("data_hora deve ser ISO 8601 com fuso")
        return value


class GateHistory(BaseModel):
    sucesso: StrictBool
    total: int = Field(strict=True, ge=0)
    eventos: list[GateEvent] = Field(max_length=20_000)

    @model_validator(mode="after")
    def verify_history(self):
        if not self.sucesso or self.total != len(self.eventos):
            raise ValueError("histórico incompleto")
        if len({event.id for event in self.eventos}) != self.total:
            raise ValueError("histórico com identificador duplicado")
        self.eventos.sort(key=lambda event: (event.data_hora, event.id), reverse=True)
        return self


class GateSnapshot(BaseModel):
    status: Literal["available", "stale", "disabled", "unavailable"]
    checked_at: AwareDatetime | None = None
    total: int = 0
    eventos: list[GateEvent] = Field(default_factory=list)


class GateMonitor:
    def __init__(self, url: str = "", key: str = "", *, transport: httpx.AsyncBaseTransport | None = None):
        self.url = url
        self.key = key
        self.transport = transport
        self.lock = asyncio.Lock()
        self.snapshot = GateSnapshot(status="unavailable" if url and key else "disabled")
        self.next_request = 0.0

    @classmethod
    def from_env(cls):
        url = os.getenv("RPA_API_URL", "").strip()
        key = os.getenv("RPA_API_KEY", "").strip()
        if not url and not key:
            return cls()
        try:
            parsed = urlsplit(url)
            valid_url = (parsed.scheme == "https" and parsed.hostname and parsed.port in (None, 443)
                         and parsed.path.startswith("/") and not parsed.query and not parsed.fragment
                         and parsed.username is None and parsed.password is None)
        except ValueError:
            valid_url = False
        if not valid_url or not key or len(key) > 512 or not all(33 <= ord(char) <= 126 for char in key):
            logger.warning("Configuração do monitoramento da cancela incompleta ou inválida")
            return cls()
        return cls(url, key)

    async def refresh(self) -> GateSnapshot:
        async with self.lock:
            if self.snapshot.status == "disabled" or monotonic() < self.next_request:
                return self.snapshot

            try:
                async with asyncio.timeout(7):
                    history = await self.read_history()
            except (TimeoutError, httpx.HTTPError, ValidationError, ValueError) as error:
                if isinstance(error, httpx.HTTPStatusError):
                    logger.warning("Consulta ao histórico da cancela retornou HTTP %s", error.response.status_code)
                else:
                    logger.warning("Histórico da cancela indisponível (%s)", type(error).__name__)
                status = "stale" if self.snapshot.checked_at else "unavailable"
                self.snapshot = self.snapshot.model_copy(update={"status": status})
                self.next_request = monotonic() + 8
            else:
                self.snapshot = GateSnapshot(
                    status="available", checked_at=datetime.now(timezone.utc),
                    total=history.total, eventos=history.eventos,
                )
                self.next_request = monotonic() + 2
            return self.snapshot

    async def read_history(self) -> GateHistory:
        headers = {"x-api-key": self.key, "Accept": "application/json", "Accept-Encoding": "identity"}
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=False, transport=self.transport) as client:
            async with client.stream("GET", self.url, headers=headers) as response:
                response.raise_for_status()
                if response.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
                    raise ValueError("tipo de resposta inesperado")
                if response.headers.get("content-encoding", "identity").lower() != "identity":
                    raise ValueError("codificação de resposta inesperada")
                raw = bytearray()
                async for chunk in response.aiter_bytes():
                    if len(raw) + len(chunk) > MAX_BYTES:
                        raise ValueError("histórico excede o limite da resposta")
                    raw.extend(chunk)
        return GateHistory.model_validate_json(raw)


@router.get("/gate-events", response_model=GateSnapshot, responses={503: {"model": GateSnapshot}})
async def gate_events(request: Request):
    result = await request.app.state.gate_monitor.refresh()
    if result.status == "unavailable":
        return JSONResponse(status_code=503, content=result.model_dump(mode="json"))
    return result
