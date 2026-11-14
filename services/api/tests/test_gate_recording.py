import json

from fastapi.testclient import TestClient

from app.main import app


def test_gate_recording_serves_only_referenced_media(tmp_path, monkeypatch):
    monkeypatch.setenv("PATIO_VISION_DIR", str(tmp_path))
    annotated = tmp_path / "gate.mp4"
    annotated.write_bytes(b"abcdefgh")
    (tmp_path / "unlisted.jpg").write_bytes(b"private")
    (tmp_path / "linked.jpg").symlink_to(tmp_path / "unlisted.jpg")
    with TestClient(app) as client:
        assert client.get("/api/gs/vision").status_code == 404

        evaluation = {
            "schema_version": 1,
            "data_origin": "PUBLIC_VIDEO",
            "source": {},
            "model": {},
            "video": {"url": "/api/gs/vision/media/gate.mp4"},
            "events": [{"evidence_url": "/api/gs/vision/media/linked.jpg"}],
        }
        report = tmp_path / "report.json"
        report.write_text(json.dumps(evaluation), encoding="utf-8")

        assert client.get("/api/gs/vision").json() == evaluation
        clip = client.get("/api/gs/vision/media/gate.mp4", headers={"Range": "bytes=1-3"})
        assert clip.status_code == 206
        assert clip.headers["content-type"] == "video/mp4"
        assert clip.content == b"bcd"
        assert client.get("/api/gs/vision/media/unlisted.jpg").status_code == 404
        assert client.get("/api/gs/vision/media/linked.jpg").status_code == 404

        report.write_text("{}", encoding="utf-8")
        assert client.get("/api/gs/vision").status_code == 404


def test_operator_recording_is_available_only_at_the_local_origin(tmp_path, monkeypatch):
    import json
    from pathlib import Path

    source = Path(__file__).resolve().parents[2] / "vision" / "artifacts" / "report.json"
    report = json.loads(source.read_text(encoding="utf-8"))
    report["data_origin"] = "OPERATOR_VIDEO"
    (tmp_path / "report.json").write_text(json.dumps(report), encoding="utf-8")
    monkeypatch.setenv("PATIO_VISION_DIR", str(tmp_path))
    monkeypatch.setenv("PATIO_OPERATOR_CAMERA", "1")
    monkeypatch.delenv("PATIO_PUBLIC_ORIGIN", raising=False)
    with TestClient(app, base_url="http://127.0.0.1") as client:
        assert client.get("/api/gs/vision").json()["data_origin"] == "OPERATOR_VIDEO"
        assert client.get("/api/gs/vision", headers={"Host": "public.example"}).status_code == 404
    monkeypatch.setenv("PATIO_PUBLIC_ORIGIN", "https://public.example")
    with TestClient(app, base_url="http://127.0.0.1") as client:
        assert client.get("/api/gs/vision").status_code == 404
