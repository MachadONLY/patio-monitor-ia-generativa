from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.archive import ObservationArchive
from app.main import Area, Ingestion, app
from app.rio import RIO_SOURCE, RioObservation


def test_live_history_survives_reopen_and_replay_respects_cursor(tmp_path):
    area = Area(
        name="Recorte de teste", source="Teste", origin=(-43.36, -22.99),
        ring=[(-43.37, -23), (-43.35, -23), (-43.35, -22.98), (-43.37, -23)],
    )
    path = tmp_path / "observations.sqlite3"
    archive = ObservationArchive(path, "rio")
    archive.initialize()
    now = datetime.now(timezone.utc)
    first = RioObservation(
        vehicleId="A01-B", latitude=-22.99, longitude=-43.36,
        observedAt=now - timedelta(seconds=35), receivedAt=now,
    )
    second = first.model_copy(update={"observedAt": now - timedelta(seconds=10)})
    archive.save([first, second, first], now)
    archive.save([first.model_copy(update={"receivedAt": now + timedelta(seconds=1)})], now)
    archive.save([first.model_copy(update={"observedAt": now - timedelta(seconds=200)})], now)
    independent_archive = ObservationArchive(path, "other")
    assert independent_archive.bounds() is None

    with TestClient(app) as client:
        reopened = ObservationArchive(path, "rio")
        reopened.initialize()
        app.state.ingestion = Ingestion(source=RIO_SOURCE, area=area, archive=reopened)
        replay = client.get("/api/vehicles/snapshot", params={"mode": "REPLAY", "at": first.observedAt.isoformat()})
        assert replay.status_code == 200
        replay_data = replay.json()
        assert replay_data["source"] == RIO_SOURCE
        assert len(replay_data["range"]) == 2
        assert [RioObservation.model_validate(row) for row in replay_data["vehicles"]] == [first]
        assert not reopened.snapshot(now - timedelta(days=1))
        history = client.get("/api/vehicles/A01-B/history", params={"at": now.isoformat(), "mode": "LIVE"})
        assert history.status_code == 200
        assert [RioObservation.model_validate(row) for row in history.json()["observations"]] == [second, first]
