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
