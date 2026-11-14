import pytest

pytest.importorskip("cv2")
pytest.importorskip("sklearn")

from services.vision.inference import Detection, Tracker


def track_centers(centers):
    tracker = Tracker(line=50, margin=4, max_age=2)
    events = []
    for frame, center in enumerate(centers):
        detection = Detection((center - 15, 0, center + 15, 30), 0.99)
        events.extend(
            (track.id, direction)
            for track, direction in tracker.update([detection], frame)
        )
    return events


def test_confirmed_crossings_preserve_track_and_direction():
    assert track_centers([34, 36, 38, 40, 48, 51, 57, 59, 61, 64]) == [
        (1, "LEFT_TO_RIGHT")
    ]
    assert track_centers([66, 64, 62, 60, 52, 49, 43, 41, 39, 36]) == [
        (1, "RIGHT_TO_LEFT")
    ]


def test_hovering_near_line_is_not_a_crossing():
    assert track_centers([33, 35, 39, 41, 47, 51, 54, 55, 53, 55, 44]) == []


def test_new_track_does_not_inherit_crossing_after_gap():
    tracker = Tracker(line=50, margin=4, max_age=1)
    detection = Detection((22, 0, 52, 30), 0.99)
    for frame in range(4):
        assert tracker.update([detection], frame) == []
    for frame in range(6, 10):
        assert tracker.update([Detection((50, 0, 80, 30), 0.99)], frame) == []
    assert tracker.tracks[0].id == 2
