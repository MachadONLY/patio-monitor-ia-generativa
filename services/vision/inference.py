"""Produce timestamped, frame-backed line crossings from a recorded clip."""

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from time import perf_counter

import cv2

from .detector import BusDetector, overlap
from .train import prepare, prepare_backbone, sha256

MEDIA = "/api/gs/vision/media/"


@dataclass
class Detection:
    box: tuple[int, int, int, int]
    confidence: float

    @property
    def center(self):
        return (self.box[0] + self.box[2]) / 2


@dataclass
class Track:
    id: int
    detection: Detection
    last_frame: int
    observations: int = 1
    confirmed_side: int = 0
    pending_side: int = 0
    pending_count: int = 0

    def update(self, detected, frame, line, margin):
        self.detection = detected
        self.last_frame = frame
        self.observations += 1
        return self.observe(line, margin)

    def observe(self, line, margin):
        center = self.detection.center
        side = -1 if center < line - margin else 1 if center > line + margin else 0
        if side == 0:
            self.pending_count = 0
            self.pending_side = 0
            return None
        self.pending_count = self.pending_count + 1 if side == self.pending_side else 1
        self.pending_side = side
        if self.pending_count < 3:
            return None
        previous = self.confirmed_side
        self.confirmed_side = side
        if previous and previous != side and self.observations >= 6:
            return "LEFT_TO_RIGHT" if side > 0 else "RIGHT_TO_LEFT"
        return None


class Tracker:
    def __init__(self, line, margin, max_age):
        self.line = line
        self.margin = margin
        self.max_age = max_age
        self.tracks = []
        self.next_id = 1

    def update(self, detections, frame):
        self.tracks = [
            track for track in self.tracks if frame - track.last_frame <= self.max_age
        ]
        pairs = sorted(
            (
                (overlap(detection.box, track.detection.box), track.id, index)
                for track in self.tracks
                for index, detection in enumerate(detections)
            ),
            reverse=True,
        )
        tracks_by_id = {track.id: track for track in self.tracks}
        used_tracks, used_detections, crossings = set(), set(), []
        for similarity, track_id, index in pairs:
            if similarity < 0.20 or track_id in used_tracks or index in used_detections:
                continue
            track = tracks_by_id[track_id]
            direction = track.update(detections[index], frame, self.line, self.margin)
            used_tracks.add(track_id)
            used_detections.add(index)
            if direction:
                crossings.append((track, direction))
        for index, detection in enumerate(detections):
            if index in used_detections:
                continue
            self.tracks.append(Track(self.next_id, detection, frame))
            self.next_id += 1
        return crossings


def annotate(frame, tracker, frame_id, video_fps, events):
    height, width = frame.shape[:2]
    color = (115, 230, 84)
    cv2.line(
        frame,
        (tracker.line, int(height * 0.47)),
        (tracker.line, height - 4),
        (32, 219, 255),
        2,
    )
    cv2.putText(
        frame,
        "LINHA VIRTUAL",
        (tracker.line + 8, int(height * 0.46)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.43,
        (32, 219, 255),
        1,
        cv2.LINE_AA,
    )
    for track in tracker.tracks:
        if frame_id - track.last_frame > video_fps / 3 or track.observations < 3:
            continue
        left, top, right, bottom = track.detection.box
        cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
        report = f"ONIBUS {track.id}  {track.detection.confidence:.2f}"
        cv2.putText(
            frame,
            report,
            (left, max(39, top - 7)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.52,
            color,
            1,
            cv2.LINE_AA,
        )
    cv2.rectangle(frame, (0, 0), (width, 27), (20, 34, 23), -1)
    cv2.putText(
        frame,
        f"GRAVACAO PUBLICA / CAMERA FIXA  {frame_id / video_fps:05.2f}s",
        (12, 18),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.46,
        (245, 248, 240),
        1,
        cv2.LINE_AA,
    )
    if events and frame_id - events[-1]["frame"] < 2 * video_fps:
        label = (
            "PASSAGEM  ESQUERDA > DIREITA"
            if events[-1]["direction"] == "LEFT_TO_RIGHT"
            else "PASSAGEM  DIREITA > ESQUERDA"
        )
        cv2.rectangle(frame, (0, height - 28), (width, height), (20, 34, 23), -1)
        cv2.putText(
            frame,
            label,
            (12, height - 9),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.49,
            color,
            1,
            cv2.LINE_AA,
        )
    return frame


def infer(directory: Path, output: Path):
    cv2.setNumThreads(2)
    entry = prepare(directory)["prague"]
    source = directory / "prague.webm"
    backbone = prepare_backbone(directory)
    checkpoint = output / "bus-heads.npz"
    metrics = json.loads((output / "metrics.json").read_text())
    if sha256(checkpoint) != metrics["checkpoint_sha256"]:
        raise ValueError("Pesos do detector não correspondem às métricas")
    detector = BusDetector(checkpoint, backbone)
    cap = cv2.VideoCapture(str(source))
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        raise ValueError("Vídeo não foi decodificado")
    width, height = 768, 432
    detection_period = max(1, round(fps / 8))
    tracker = Tracker(round(width * 0.61), round(width * 0.023), round(fps * 0.65))
    video = output / "annotated.mp4"
    temporary = output / "annotated.part.mp4"
    encoder = subprocess.Popen(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "bgr24",
            "-s",
            f"{width}x{height}",
            "-r",
            str(fps),
            "-i",
            "-",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "25",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-metadata",
            "comment=Adaptacao: anotacoes CV. Video original: ŠJů / Wikimedia Commons / CC BY 4.0.",
            str(temporary),
        ],
        stdin=subprocess.PIPE,
    )
    events = []
    frame_id = 0
    detector_calls = 0
    detector_seconds = 0.0
    started = perf_counter()
    try:
        while True:
            ok, decoded = cap.read()
            if not ok:
                break
            frame = cv2.resize(decoded, (width, height))
            new_events = []
            if frame_id % detection_period == 0:
                detector_started = perf_counter()
                candidates = detector.scan(frame)
                detector_seconds += perf_counter() - detector_started
                detector_calls += 1
                detections = [
                    Detection(box, confidence)
                    for box, confidence in candidates
                    if confidence >= metrics["threshold"] and box[3] > height * 0.63
                ]
                for track, direction in tracker.update(detections, frame_id):
                    event_id = f"crossing-{len(events) + 1:02d}"
                    current_event = {
                        "id": event_id,
                        "frame": frame_id,
                        "timestamp_seconds": round(frame_id / fps, 3),
                        "direction": direction,
                        "confidence": round(track.detection.confidence, 4),
                        "bbox": list(track.detection.box),
                        "track_id": track.id,
                        "evidence_url": f"{MEDIA}{event_id}.jpg",
                    }
                    events.append(current_event)
                    new_events.append(current_event)
            annotated = annotate(frame, tracker, frame_id, fps, events)
            for crossing in new_events:
                image = output / f"{crossing['id']}.jpg"
                if not cv2.imwrite(str(image), annotated):
                    raise RuntimeError(f"Falha ao gravar {image.name}")
            encoder.stdin.write(annotated.tobytes())
            frame_id += 1
    except BaseException:
        encoder.kill()
        raise
    finally:
        cap.release()
        encoder.stdin.close()
        if encoder.wait() != 0:
            temporary.unlink(missing_ok=True)
    if not temporary.exists() or not frame_id:
        raise RuntimeError("Falha ao gravar vídeo anotado")
    temporary.replace(video)
    wall_seconds = perf_counter() - started
    report = {
        "schema_version": 1,
        "data_origin": "PUBLIC_VIDEO",
        "source": {
            key: entry[key]
            for key in (
                "title",
                "author",
                "license",
                "license_url",
                "source_url",
                "sha256",
            )
        },
        "model": {
            "family": "YOLOX + cabeças para ônibus",
            "sha256": sha256(checkpoint),
            "backbone_sha256": sha256(backbone),
        },
        "video": {
            "url": f"{MEDIA}{video.name}",
            "duration_seconds": round(frame_id / fps, 3),
            "width": width,
            "height": height,
            "sha256": sha256(video),
        },
        "line": {"x": tracker.line, "deadband_px": tracker.margin, "unit": "video_px"},
        "events": events,
        "metrics": metrics,
        "processing": {
            "decoded_frames": frame_id,
            "source_fps": round(fps, 3),
            "detector_calls": detector_calls,
            "sampled_fps": round(fps / detection_period, 3),
            "measured_decoder_encoder_fps": round(frame_id / wall_seconds, 3),
            "measured_detector_fps": round(detector_calls / detector_seconds, 3),
        },
    }
    (output / "report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    )
    return report
