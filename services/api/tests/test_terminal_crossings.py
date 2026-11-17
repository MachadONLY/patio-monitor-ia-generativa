import asyncio
from contextlib import closing
from datetime import datetime, timedelta, timezone

import sqlite3

from fastapi.testclient import TestClient

from app import gate_events
from app.archive import ObservationArchive
from app import main
from app.main import Ingestion, app
from app.rio import RIO_SOURCE, RioObservation

INSIDE = (-43.3664, -23.0011)
OUTSIDE = (-43.3664, -23.00025)
BOUNDARY = (-43.3664162, -23.0006336)


def reading(at, point, vehicle_id="GPS-01"):
    return RioObservation(
        vehicleId=vehicle_id, longitude=point[0], latitude=point[1],
        lineLabel="BRT", observedAt=at, receivedAt=at,
    )


def test_alvorada_boundary_has_uncertainty_band():
    assert gate_events.classify(*gate_events.project(*INSIDE)) == "inside"
    assert gate_events.classify(*gate_events.project(*OUTSIDE)) == "outside"
    assert gate_events.classify(*gate_events.project(*BOUNDARY)) is None


def test_crossings_persist_and_api_preserves_intervals_after_reopen(tmp_path):
    path = tmp_path / "observations.sqlite"
    archive = ObservationArchive(path, "rio-scope", terminal_events=True)
    archive.initialize()
    start = datetime.now(timezone.utc) - timedelta(minutes=3)
    first = reading(start, OUTSIDE)
    stable_out = reading(start + timedelta(seconds=10), OUTSIDE)
    entering = reading(start + timedelta(seconds=20), INSIDE)
    entered = reading(start + timedelta(seconds=30), INSIDE)
    archive.save([stable_out, first], stable_out.observedAt)
    archive.save([entering, entering], entering.observedAt)
    assert archive.crossings(entering.observedAt) == []
    archive.save([entered], entered.observedAt)

    reopened = ObservationArchive(path, "rio-scope", terminal_events=True)
    reopened.initialize()
    leaving = reading(start + timedelta(seconds=40), OUTSIDE)
    left = reading(start + timedelta(seconds=50), OUTSIDE)
    reopened.save([entering, leaving, left], left.observedAt)
    reopened.save([entered, left], left.observedAt)
    assert not ObservationArchive(path, "other-scope", terminal_events=True).crossings(left.observedAt)
    assert not reopened.crossings(left.observedAt + timedelta(days=15))

    with TestClient(app) as client:
        app.state.ingestion = Ingestion(source=RIO_SOURCE, archive=reopened, state="connected")
        response = client.get("/api/vehicles/terminal-crossings")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"
        assert data["source"] == RIO_SOURCE
        assert data["boundaryBufferMeters"] == 15
        assert data["summary"] == {
            "windowHours": 24,
            "entries": 1,
            "exits": 1,
            "paired": 1,
            "averageMinutes": 0.3,
        }
        exit_event, entry_event = data["events"]
        for event, kind, start_reading, first_reading, last_reading in [
            (entry_event, "entry", stable_out, entering, entered),
            (exit_event, "exit", entered, leaving, left),
        ]:
            assert event["kind"] == kind
            assert event["vehicleId"] == "GPS-01"
            assert event["line"] == "BRT"
            assert datetime.fromisoformat(event["betweenFrom"]) == start_reading.observedAt
            assert datetime.fromisoformat(event["betweenTo"]) == first_reading.observedAt
            assert datetime.fromisoformat(event["confirmedAt"]) == last_reading.observedAt
        app.state.ingestion.archive_error = True
        status = client.get("/api/vehicles/terminal-crossings").json()
        assert status["status"] == "unavailable"
        assert status["events"] == data["events"]


def test_gaps_outliers_and_uncertain_fixes_do_not_create_crossings(tmp_path):
    archive = ObservationArchive(tmp_path / "observations.sqlite", "rio-scope", terminal_events=True)
    archive.initialize()
    start = datetime.now(timezone.utc) - timedelta(minutes=8)

    for offset, point in [(0, INSIDE), (15, INSIDE), (30, OUTSIDE), (45, BOUNDARY), (60, OUTSIDE)]:
        at = start + timedelta(seconds=offset)
        archive.save([reading(at, point)], at)
    archive.save([], start + timedelta(seconds=90))
    archive.save([reading(start + timedelta(seconds=30), OUTSIDE)], start + timedelta(seconds=105))
    for offset, point in [(180, OUTSIDE), (195, OUTSIDE), (196, INSIDE), (211, INSIDE)]:
        at = start + timedelta(seconds=offset)
        archive.save([reading(at, point)], at)
    assert archive.crossings(at) == []
    for offset, point in [(226, OUTSIDE), (241, OUTSIDE)]:
        at = start + timedelta(seconds=offset)
        archive.save([reading(at, point)], at)
    assert [event["kind"] for event in archive.crossings(at)] == ["exit"]


def test_crossings_endpoint_is_disabled_without_archive():
    with TestClient(app) as client:
        app.state.ingestion = Ingestion(source=RIO_SOURCE, state="connected")
        assert client.get("/api/vehicles/terminal-crossings").json() == {"status": "disabled", "events": []}


def test_storage_bounds_recent_events_and_waiting_vehicles(tmp_path, monkeypatch):
    monkeypatch.setattr(gate_events, "MAX_EVENTS", 1)
    monkeypatch.setattr(gate_events, "MAX_TRACKED_VEHICLES", 3)
    path = tmp_path / "observations.sqlite"
    archive = ObservationArchive(path, "rio-scope", terminal_events=True)
    archive.initialize()
    start = datetime.now(timezone.utc) - timedelta(minutes=4)

    for offset, point in [(0, OUTSIDE), (15, OUTSIDE), (30, INSIDE), (45, INSIDE), (60, OUTSIDE), (75, OUTSIDE)]:
        at = start + timedelta(seconds=offset)
        archive.save([reading(at, point)], at)
    archive.save([reading(at, INSIDE, f"FLEET-{i}") for i in range(10)], at)
    with closing(sqlite3.connect(path)) as db:
        assert db.execute("SELECT count(*) FROM terminal_crossing_state").fetchone() == (3,)
    assert [event["kind"] for event in archive.crossings(at)] == ["exit"]
    archive.save([], at + timedelta(days=15))
    with closing(sqlite3.connect(path)) as db:
        assert db.execute("SELECT count(*) FROM terminal_crossing_state").fetchone() == (0,)
        assert db.execute("SELECT count(*) FROM terminal_crossings").fetchone() == (0,)


def test_configured_rio_lifespan_enables_crossings_for_the_real_perimeter(tmp_path, monkeypatch):
    class QuietRioProvider:
        async def positions(self, _company):
            await asyncio.Future()

        async def close(self):
            pass

    monkeypatch.setattr(main, "RioBrt", QuietRioProvider)
    monkeypatch.setenv("PATIO_LIVE_PROVIDER", "rio_brt")
    monkeypatch.setenv("PATIO_ARCHIVE_FILE", str(tmp_path / "observations.sqlite3"))
    monkeypatch.delenv("PATIO_AREA_FILE", raising=False)

    with TestClient(app) as client:
        response = client.get("/api/vehicles/terminal-crossings").json()
        assert app.state.ingestion.archive.terminal_events
        assert response["status"] == "unavailable"
        assert response["events"] == []
        assert response["perimeter"] == "https://www.openstreetmap.org/relation/4571813"
