"""Train and evaluate the project-specific detector with video-disjoint splits."""

import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

import cv2
import numpy as np
from sklearn.linear_model import LogisticRegression, Ridge

from .detector import BusDetector, RegionProposals, overlap

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / "dataset.json"


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def prepare(directory, names=None):
    directory.mkdir(parents=True, exist_ok=True)
    dataset = json.loads(MANIFEST.read_text())
    for name, entry in dataset.items():
        if names is not None and name not in names:
            continue
        target = directory / f"{name}.webm"
        if not target.exists():
            request = Request(
                entry["download_url"],
                headers={"User-Agent": "PatioMonitorCV/1.0 reproducibility"},
            )
            with urlopen(request, timeout=60) as response:
                contents = response.read(30 * 1024 * 1024 + 1)
            if (
                len(contents) > 30 * 1024 * 1024
                or hashlib.sha256(contents).hexdigest() != entry["sha256"]
            ):
                raise ValueError(f"Hash de fonte diverge: {name}")
            target.write_bytes(contents)
        if sha256(target) != entry["sha256"]:
            raise ValueError(f"Hash de fonte diverge: {name}")
    return {name: entry for name, entry in dataset.items() if names is None or name in names}


def examples(directory, dataset, split):
    for name, entry in dataset.items():
        if entry["split"] != split:
            continue
        capture = cv2.VideoCapture(str(directory / f"{name}.webm"))
        try:
            for seconds, *annotation in entry["frames"]:
                capture.set(cv2.CAP_PROP_POS_MSEC, seconds * 1000)
                ok, frame = capture.read()
                if not ok:
                    raise ValueError(f"Não foi possível ler {name} em {seconds}s")
                height, width = frame.shape[:2]
                scale = (width / 240, height / 135, width / 240, height / 135)
                box = tuple(round(v * s) for v, s in zip(annotation, scale))
                yield name, seconds, frame, box
        finally:
            capture.release()


def measure(predictions, threshold):
    tp = fp = fn = 0
    for _, _, target, found in predictions:
        matches = [box for box, score in found if score >= threshold]
        correct = bool(target) and any(overlap(target, box) >= 0.5 for box in matches)
        tp += int(correct)
        fp += len(matches) - int(correct)
        fn += int(bool(target) and not correct)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "frames": len(predictions),
        "iou_threshold": 0.5,
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


BACKBONE_URL = "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/object_detection_yolox/object_detection_yolox_2022nov.onnx"
BACKBONE_HASH = "c5c2d13e59ae883e6af3b45daea64af4833a4951c92d116ec270d9ddbe998063"


def prepare_backbone(directory):
    path = directory / "yolox.onnx"
    if not path.exists():
        with urlopen(BACKBONE_URL, timeout=60) as response:
            data = response.read(40 * 1024 * 1024 + 1)
        if hashlib.sha256(data).hexdigest() != BACKBONE_HASH:
            raise ValueError("Hash do modelo de propostas diverge")
        path.write_bytes(data)
    if sha256(path) != BACKBONE_HASH:
        raise ValueError("Hash do modelo de propostas diverge")
    return path


def train(directory, output):
    cv2.setNumThreads(2)
    dataset = prepare(directory)
    backbone = prepare_backbone(directory)
    proposals = RegionProposals(backbone)
    training = list(examples(directory, dataset, "train"))
    descriptors, labels, refine_x, refine_y = [], [], [], []
    for _, _, frame, target in training:
        for mirrored in (False, True):
            transformed_frame, transformed_target = frame, target
            if mirrored:
                width = frame.shape[1]
                transformed_frame = cv2.flip(frame, 1)
                if target:
                    x1, y1, x2, y2 = target
                    transformed_target = (width - x2, y1, width - x1, y2)
            for box, feature in proposals(transformed_frame):
                iou = overlap(box, transformed_target) if transformed_target else 0
                if 0.30 < iou < 0.55:
                    continue
                descriptors.append(feature)
                labels.append(int(iou >= 0.55))
                if iou >= 0.55:
                    x1, y1, x2, y2 = box
                    refine_x.append(feature)
                    refine_y.append(
                        (np.asarray(transformed_target) - box)
                        / np.array([x2 - x1, y2 - y1] * 2)
                    )
    model = LogisticRegression(
        C=0.30, class_weight="balanced", random_state=2026, max_iter=500
    )
    model.fit(descriptors, labels)
    refiner = Ridge(alpha=20.0).fit(refine_x, refine_y)
    output.mkdir(parents=True, exist_ok=True)
    checkpoint = output / "bus-heads.npz"
    np.savez_compressed(
        checkpoint,
        classifier=model.coef_.ravel(),
        bias=model.intercept_[0],
        refinement=refiner.coef_,
        offset=refiner.intercept_,
    )
    detector = BusDetector(checkpoint, backbone)
    scanned = {}
    for split in ("validation", "test"):
        scanned[split] = [
            (name, t, box, detector.scan(frame))
            for name, t, frame, box in examples(directory, dataset, split)
        ]
    validation_options = [
        (float(v), measure(scanned["validation"], v))
        for v in np.linspace(0.01, 0.99, 99)
    ]
    threshold, val = max(
        validation_options, key=lambda run: (run[1]["f1"], run[1]["precision"], run[0])
    )
    result = {
        "training_frames": len(training),
        "training_videos": len({name for name, *_ in training}),
        "training_proposals": len(labels),
        "positive_proposals": sum(labels),
        "threshold": threshold,
        "validation": val,
        "test": measure(scanned["test"], threshold),
        "checkpoint_sha256": sha256(checkpoint),
        "backbone_sha256": sha256(backbone),
    }
    (output / "metrics.json").write_text(json.dumps(result, indent=2) + "\n")
    return result
