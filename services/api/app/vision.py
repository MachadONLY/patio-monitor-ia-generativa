"""Serve the recorded evaluation produced by the gate detector."""

import json
import os
from pathlib import Path
import re

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

router = APIRouter(prefix="/api/gs/vision")
MEDIA_PREFIX = "/api/gs/vision/media/"
MEDIA_TYPES = {".mp4": "video/mp4", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
MAX_REPORT_BYTES = 2 * 1024 * 1024


def vision_directory() -> Path:
    configured = os.getenv("PATIO_VISION_DIR")
    if configured:
        return Path(configured).resolve()
    return Path(__file__).resolve().parents[2] / "vision" / "artifacts"


def read_report(directory: Path, request: Request) -> dict:
    try:
        with (directory / "report.json").open("rb") as report:
            raw = report.read(MAX_REPORT_BYTES + 1)
        if len(raw) > MAX_REPORT_BYTES:
            raise ValueError
        data = json.loads(raw)
        if (
            not isinstance(data, dict)
            or data.get("schema_version") != 1
            or data.get("data_origin") not in ("PUBLIC_VIDEO", "OPERATOR_VIDEO", "DEMO")
            or not isinstance(data.get("source"), dict)
            or not isinstance(data.get("model"), dict)
            or not isinstance(data.get("video"), dict)
            or not isinstance(data.get("events"), list)
            or not all(isinstance(event, dict) for event in data["events"])
        ):
            raise ValueError
    except (OSError, ValueError, RecursionError):
        raise HTTPException(404, "Gravação da câmera indisponível") from None
    if data["data_origin"] == "OPERATOR_VIDEO" and (
        os.getenv("PATIO_OPERATOR_CAMERA") != "1"
        or os.getenv("PATIO_PUBLIC_ORIGIN")
        or request.url.hostname not in {"localhost", "127.0.0.1", "::1"}
    ):
        raise HTTPException(404, "Gravação da câmera indisponível")
    return data


@router.get("")
def get_evaluation(request: Request):
    return read_report(vision_directory(), request)


@router.get("/media/{filename}")
def get_media(filename: str, request: Request):
    directory = vision_directory()
    media_type = MEDIA_TYPES.get(Path(filename).suffix)
    if not media_type or not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}", filename):
        raise HTTPException(404, "Arquivo indisponível")
    evaluation = read_report(directory, request)
    media_url = f"{MEDIA_PREFIX}{filename}"
    references = [evaluation["video"].get("url"), *(event.get("evidence_url") for event in evaluation["events"])]
    path = directory / filename
    if media_url not in references or path.is_symlink() or not path.is_file():
        raise HTTPException(404, "Arquivo indisponível")
    return FileResponse(path, media_type=media_type)
