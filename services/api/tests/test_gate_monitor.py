import httpx
from fastapi.testclient import TestClient
import pytest

from app.gate_monitor import GateMonitor
from app.main import app


def event(identifier=1, timestamp="2026-11-09T23:35:31.147Z", kind="CANCELA_ABERTA"):
    return {
        "id": identifier,
        "dispositivo": "SMART_BUS_GATE_01",
        "evento": kind,
        "distancia_cm": 13.11975,
        "movimento": False,
        "tipo_registro": "ABERTURA_CANCELA",
        "data_hora": timestamp,
    }


def test_gate_history_refreshes_and_retains_last_verified_snapshot(monkeypatch, caplog):
    now = 0.0
    monkeypatch.setattr("app.gate_monitor.monotonic", lambda: now)
    key = "chave-apenas-de-teste"
    first = event()
    second = event(2, "2026-11-10T01:05:00Z", "CANCELA_FECHADA")
    results = iter((
        httpx.Response(200, json={"sucesso": True, "total": 1, "eventos": [first]}),
        httpx.Response(200, json={"sucesso": True, "total": 2, "eventos": [first, second], "internal": key}),
        httpx.Response(403, text=key),
    ))
    calls = []

    def get_history(request):
        assert request.method == "GET"
        assert request.url == httpx.URL("https://example.org/webhook/eventos")
        assert request.headers["x-api-key"] == key
        calls.append(request.url)
        return next(results)

    with TestClient(app) as client:
        app.state.gate_monitor = GateMonitor(
            "https://example.org/webhook/eventos", key, transport=httpx.MockTransport(get_history),
        )
        initial = client.get("/api/rpa/gate-events")
        assert initial.status_code == 200
        assert initial.json()["total"] == 1
        assert client.get("/api/rpa/gate-events").json() == initial.json()
        assert len(calls) == 1

        now = 3.0
        updated = client.get("/api/rpa/gate-events")
        assert updated.status_code == 200
        assert [record["id"] for record in updated.json()["eventos"]] == [2, 1]
        assert "internal" not in updated.json()

        now = 6.0
        stale = client.get("/api/rpa/gate-events")
        assert stale.status_code == 200
        assert stale.json() == {**updated.json(), "status": "stale"}
        assert key not in stale.text and key not in caplog.text
        assert "retornou HTTP 403" in caplog.text


@pytest.mark.parametrize("bad_response", [
    httpx.Response(302, headers={"Location": "https://other.example/"}),
    httpx.Response(200, json={"sucesso": False, "total": 0, "eventos": []}),
    httpx.Response(200, json={"sucesso": True, "total": 1, "eventos": []}),
    httpx.Response(200, json={"sucesso": True, "total": 2, "eventos": [event(), event()]}),
    httpx.Response(200, json={"sucesso": True, "total": 1, "eventos": [event(timestamp="2026-11-09T23:35:31")]}),
    httpx.Response(200, json={"sucesso": True, "total": 1, "eventos": [{**event(), "movimento": "false"}]}),
    httpx.Response(200, text="<html>Gateway page</html>"),
])
def test_gate_rejects_invalid_upstream_and_does_not_redirect(bad_response):
    def get_history(request):
        assert request.url.host == "example.org"
        return bad_response

    with TestClient(app) as client:
        app.state.gate_monitor = GateMonitor(
            "https://example.org/webhook/eventos", "chave-de-teste", transport=httpx.MockTransport(get_history),
        )
        response = client.get("/api/rpa/gate-events")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "checked_at": None, "total": 0, "eventos": []}


def test_gate_displays_empty_or_disabled_without_inventing_records(monkeypatch):
    monkeypatch.delenv("RPA_API_URL", raising=False)
    monkeypatch.delenv("RPA_API_KEY", raising=False)

    with TestClient(app) as client:
        assert client.get("/api/rpa/gate-events").json()["status"] == "disabled"
        app.state.gate_monitor = GateMonitor(
            "https://example.org/webhook/eventos", "chave-de-teste",
            transport=httpx.MockTransport(lambda _: httpx.Response(200, json={"sucesso": True, "total": 0, "eventos": []})),
        )
        response = client.get("/api/rpa/gate-events")
    assert response.status_code == 200
    assert response.json()["status"] == "available"
    assert response.json()["checked_at"]
    assert response.json()["eventos"] == []
