import asyncio
from datetime import datetime, timedelta, timezone
import os

from google.transit import gtfs_realtime_pb2
import httpx
import pytest

from app.rio import MAX_FEED_BYTES, RIO_FEED, RioBrt, normalize_rio


def feed_at(timestamp):
    feed = gtfs_realtime_pb2.FeedMessage()
    feed.header.gtfs_realtime_version = "2.0"
    feed.header.timestamp = int(timestamp.timestamp())
    return feed


def append_position(feed, vehicle_id, timestamp, latitude=-22.9958):
    entity = feed.entity.add()
    entity.id = str(len(feed.entity))
    vehicle = entity.vehicle
    vehicle.vehicle.id = vehicle_id
    vehicle.trip.route_id = "test_route"
    vehicle.position.latitude = latitude
    vehicle.position.longitude = -43.361
    vehicle.timestamp = int(timestamp.timestamp())
    return entity


def test_observation_uses_vehicle_clock_and_deduplicates():
    received = datetime(2026, 11, 14, 16, 51, tzinfo=timezone.utc)
    header_time = received - timedelta(seconds=2)
    position_time = received - timedelta(seconds=31)
    feed = feed_at(header_time)
    append_position(feed, "TEST-A1", position_time)
    append_position(feed, "TEST-A1", received - timedelta(seconds=66))
    append_position(feed, "TEST-B1", received + timedelta(minutes=3))
    append_position(feed, "TEST-C1", position_time, latitude=95)
    append_position(feed, "TEST-D1", position_time, latitude=float("nan"))
    append_position(feed, "<script>", position_time)
    append_position(feed, "TOOLONG" * 10, position_time)
    append_position(feed, "DELETED", position_time).is_deleted = True
    append_position(feed, "MISSING", position_time).vehicle.ClearField("timestamp")

    records = normalize_rio(feed.SerializeToString(), received)

    assert len(records) == 1
    observation = records[0]
    assert observation.vehicleId == "TEST-A1"
    assert observation.lineLabel == "test_route"
    assert observation.lineId is None
    assert observation.latitude == pytest.approx(-22.9958)
    assert observation.longitude == pytest.approx(-43.361)
    assert observation.observedAt == position_time
    assert observation.receivedAt == received


@pytest.mark.parametrize(
    "payload,reason",
    [
        (b"", "rio_invalid_header"),
        (b"\xff", "rio_invalid_protobuf"),
        (b"b" * (MAX_FEED_BYTES + 1), "rio_feed_too_large"),
    ],
)
def test_malformed_or_oversized_payloads_are_rejected(payload, reason):
    with pytest.raises(ValueError, match=reason):
        normalize_rio(payload, datetime.now(timezone.utc))


def read_with_transport(handler):
    async def request():
        provider = RioBrt(transport=httpx.MockTransport(handler))
        try:
            return await provider.positions()
        finally:
            await provider.close()

    return asyncio.run(request())


def test_https_public_endpoint_needs_no_credentials():
    now = datetime.now(timezone.utc)
    feed = feed_at(now)
    append_position(feed, "TEST-A1", now)

    def upstream(request):
        assert request.method == "GET"
        assert str(request.url) == RIO_FEED
        assert "authorization" not in request.headers
        assert "cookie" not in request.headers
        return httpx.Response(
            200, content=feed.SerializeToString(),
            headers={"Content-Type": "application/x-protobuf"},
        )

    records = read_with_transport(upstream)
    assert [record.vehicleId for record in records] == ["TEST-A1"]


@pytest.mark.parametrize(
    "status,headers,reason",
    [
        (302, {"Location": "https://example.com/"}, "rio_positions_unavailable"),
        (200, {"Content-Type": "text/html"}, "rio_unsupported_media_type"),
        (
            200,
            {"Content-Type": "application/x-protobuf", "Content-Encoding": "gzip"},
            "rio_unsupported_content_encoding",
        ),
        (
            200,
            {"Content-Type": "application/x-protobuf", "Content-Length": str(MAX_FEED_BYTES + 1)},
            "rio_feed_too_large",
        ),
    ],
)
def test_http_boundary_rejects_invalid_responses(status, headers, reason):
    requests = []

    def upstream(request):
        requests.append(str(request.url))
        return httpx.Response(status, headers=headers)

    with pytest.raises(ValueError, match=reason):
        read_with_transport(upstream)
    assert requests == [RIO_FEED]


def test_transport_bounds_a_stream_with_no_content_length():
    class OversizedStream(httpx.AsyncByteStream):
        async def __aiter__(self):
            block = bytes(MAX_FEED_BYTES // 2)
            yield block
            yield block
            yield b"x"

    def upstream(_):
        return httpx.Response(
            200,
            stream=OversizedStream(),
            headers={"Content-Type": "application/x-protobuf"},
        )

    with pytest.raises(ValueError, match="rio_feed_too_large"):
        read_with_transport(upstream)


@pytest.mark.skipif(
    os.environ.get("PATIO_PROBE_RIO") != "1",
    reason="opt-in smoke test against the public MOBI-Rio feed",
)
def test_public_mobi_rio_feed():
    async def request():
        provider = RioBrt()
        try:
            return await provider.positions()
        finally:
            await provider.close()

    observations = asyncio.run(request())
    assert observations
    assert len({row.vehicleId for row in observations}) == len(observations)
    assert all(-23.2 < row.latitude < -22.6 and -44 < row.longitude < -43 for row in observations)
    assert any(abs((row.receivedAt - row.observedAt).total_seconds()) < 180 for row in observations)
