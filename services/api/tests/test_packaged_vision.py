"""Verify that the submitted evaluation plays from a clean checkout."""

import hashlib
import json
from pathlib import Path


def test_recorded_evaluation_media_is_packaged_and_matches_report():
    assets = Path(__file__).resolve().parents[2] / "vision" / "artifacts"
    report = json.loads((assets / "report.json").read_text(encoding="utf-8"))
    assert report["data_origin"] == "PUBLIC_VIDEO"
    assert report["source"]["license"] == "CC BY 4.0"

    video_name = Path(report["video"]["url"]).name
    video = assets / video_name
    assert video.is_file(), "The recorded video must ship with the repository."
    assert video.stat().st_size > 20_000
    with video.open("rb") as file:
        assert file.read(12)[4:8] == b"ftyp"
    digest = hashlib.sha256(video.read_bytes()).hexdigest()
    assert digest == report["video"]["sha256"]

    assert report["events"], "At least one real crossing should be reviewable."
    for event in report["events"]:
        filename = Path(event["evidence_url"]).name
        frame = assets / filename
        assert frame.is_file(), f"Missing crossing evidence: {filename}"
        assert frame.stat().st_size > 1_000
        with frame.open("rb") as file:
            assert file.read(3) == b"\xff\xd8\xff"
