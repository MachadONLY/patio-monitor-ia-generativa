"""Read the public MOBI-Rio BRT vehicle positions from its GTFS-RT feed."""
import asyncio
from datetime import datetime, timedelta, timezone
import re

from google.protobuf.message import DecodeError
from google.transit import gtfs_realtime_pb2
import httpx
from pydantic import Field

from .sptrans import Observation

RIO_SOURCE = "rio_mobi_gtfs_rt"
RIO_FEED = "https://dados.mobilidade.rio/gtfs/realtime"
MAX_FEED_BYTES = 2 * 1024 * 1024
# Reject outliers before deduplication so a newer bad reading cannot mask a valid one.
RIO_LATITUDE = (-23.2, -22.6)
RIO_LONGITUDE = (-44, -43)
VEHICLE_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,31}")
PROTOBUF_TYPES = {
    "application/x-protobuf", "application/protobuf", "application/octet-stream",
}


class RioObservation(Observation):
    vehicleId: str = Field(min_length=1, max_length=32, pattern=f"^{VEHICLE_ID.pattern}$")


def normalize_rio(payload: bytes, received_at: datetime) -> list[Observation]:
    if len(payload) > MAX_FEED_BYTES:
        raise ValueError("rio_feed_too_large")
    feed = gtfs_realtime_pb2.FeedMessage()
    try:
        feed.ParseFromString(payload)
    except DecodeError:
        raise ValueError("rio_invalid_protobuf") from None
    if not feed.HasField("header") or feed.header.gtfs_realtime_version != "2.0":
        raise ValueError("rio_invalid_header")

    latest: dict[str, Observation] = {}
    max_observed = received_at + timedelta(seconds=15)
    for entity in feed.entity:
        if entity.is_deleted or not entity.HasField("vehicle"):
            continue
        vehicle = entity.vehicle
        vehicle_id = vehicle.vehicle.id
        if (
            not VEHICLE_ID.fullmatch(vehicle_id)
            or not vehicle.HasField("position")
            or not vehicle.position.IsInitialized()
            or not vehicle.timestamp
        ):
            continue
        position = vehicle.position
        if not (
            RIO_LATITUDE[0] < position.latitude < RIO_LATITUDE[1]
            and RIO_LONGITUDE[0] < position.longitude < RIO_LONGITUDE[1]
        ):
            continue
        route = vehicle.trip.route_id
        try:
            observed = datetime.fromtimestamp(vehicle.timestamp, timezone.utc)
            if observed > max_observed:
                continue
            observation = RioObservation(
                vehicleId=vehicle_id,
                lineLabel=route if 0 < len(route) <= 32 and route.isprintable() else None,
                latitude=position.latitude,
                longitude=position.longitude,
                observedAt=observed,
                receivedAt=received_at,
            )
        except (OSError, OverflowError, ValueError):
            continue
        previous = latest.get(vehicle_id)
        if previous is None or previous.observedAt < observed:
            latest[vehicle_id] = observation
    return list(latest.values())


class RioBrt:
    def __init__(self, transport: httpx.AsyncBaseTransport | None = None):
        self.http = httpx.AsyncClient(
            transport=transport, timeout=8, follow_redirects=False,
            headers={
                "Accept": "application/x-protobuf",
                "Accept-Encoding": "identity",
            },
        )

    async def positions(self, company: int | None = None) -> list[Observation]:
        if company is not None:
            raise ValueError("rio_company_filter_unsupported")
        try:
            async with asyncio.timeout(12):
                async with self.http.stream("GET", RIO_FEED) as response:
                    if response.status_code != 200:
                        raise ValueError("rio_positions_unavailable")
                    media = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
                    if media not in PROTOBUF_TYPES:
                        raise ValueError("rio_unsupported_media_type")
                    if response.headers.get("content-encoding", "identity").strip().lower() != "identity":
                        raise ValueError("rio_unsupported_content_encoding")
                    length = response.headers.get("content-length")
                    if length is not None and (
                        not length.isdecimal() or len(length) > 10 or int(length) > MAX_FEED_BYTES
                    ):
                        raise ValueError("rio_feed_too_large")
                    payload = bytearray()
                    async for chunk in response.aiter_bytes(chunk_size=64 * 1024):
                        if len(payload) + len(chunk) > MAX_FEED_BYTES:
                            raise ValueError("rio_feed_too_large")
                        payload.extend(chunk)
                    received_at = datetime.now(timezone.utc)
        except TimeoutError:
            raise ValueError("rio_request_timeout") from None
        return normalize_rio(bytes(payload), received_at)

    async def close(self):
        await self.http.aclose()
