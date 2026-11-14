"""Frozen YOLOX region proposals with independently learned bus and box heads."""

from pathlib import Path

import cv2
import numpy as np

INPUT = 640
HOG = cv2.HOGDescriptor((64, 64), (16, 16), (8, 8), (8, 8), 9)


def overlap(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    shared = max(0, x2 - x1) * max(0, y2 - y1)
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - shared
    return shared / union if union else 0.0


class RegionProposals:
    def __init__(self, backbone):
        self.net = cv2.dnn.readNet(str(backbone))
        grids, strides = [], []
        for stride in (8, 16, 32):
            yy, xx = np.indices((INPUT // stride, INPUT // stride))
            grids.append(np.stack((xx.ravel(), yy.ravel()), axis=1))
            strides.append(np.full((xx.size, 1), stride))
        self.grid = np.concatenate(grids)
        self.stride = np.concatenate(strides)

    def __call__(self, frame):
        height, width = frame.shape[:2]
        scale = min(INPUT / width, INPUT / height)
        resized = cv2.resize(frame, (round(width * scale), round(height * scale)))
        padded = np.full((INPUT, INPUT, 3), 114, dtype=np.uint8)
        padded[: resized.shape[0], : resized.shape[1]] = resized
        self.net.setInput(cv2.dnn.blobFromImage(padded))
        output = self.net.forward()[0]
        centers = (output[:, :2] + self.grid) * self.stride / scale
        sizes = np.exp(output[:, 2:4]) * self.stride / scale
        objectness = output[:, 4]
        scores = objectness[:, None] * output[:, 5:]
        best = np.max(scores, axis=1)
        indices = np.flatnonzero((best > 0.08) & (objectness > 0.13))
        left_top = np.maximum(0, centers - sizes / 2)
        right_bottom = np.minimum((width, height), centers + sizes / 2)
        boxes = np.concatenate((left_top, right_bottom), axis=1).round().astype(int)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        kept = []
        for i in sorted(indices, key=lambda index: -best[index]):
            box = tuple(boxes[i])
            x1, y1, x2, y2 = box
            if (
                x2 - x1 < 14
                or y2 - y1 < 14
                or any(overlap(box, other[0]) > 0.70 for other in kept)
            ):
                continue
            patch = cv2.resize(gray[y1:y2, x1:x2], (64, 64))
            # Generic COCO scores are transfer features, not the final bus decision.
            scores_log = np.log(np.maximum(scores[i, [0, 1, 2, 3, 5, 6, 7]], 0.001))
            geometry = [np.log((x2 - x1) / (y2 - y1)), np.log(objectness[i])]
            descriptor = np.concatenate(
                (scores_log, geometry, 0.25 * HOG.compute(patch).ravel())
            )
            kept.append((box, descriptor))
            if len(kept) >= 45:
                break
        return kept


class BusDetector:
    def __init__(self, model: Path, backbone: Path):
        self.proposals = RegionProposals(backbone)
        with np.load(model, allow_pickle=False) as data:
            self.weights = data["classifier"]
            self.bias = float(data["bias"])
            self.regressor = data["refinement"]
            self.offset = data["offset"]

    def classify(self, frame, proposals):
        results = []
        height, width = frame.shape[:2]
        for box, feature in proposals:
            margin = float(self.weights @ feature + self.bias)
            probability = 1 / (1 + np.exp(-np.clip(margin, -50, 50)))
            x1, y1, x2, y2 = box
            size = np.array([x2 - x1, y2 - y1] * 2)
            correction = np.clip(self.regressor @ feature + self.offset, -0.20, 0.20)
            corrected = np.rint(
                np.clip(
                    np.asarray(box) + correction * size,
                    0,
                    (width, height, width, height),
                )
            ).astype(int)
            results.append((tuple(corrected.tolist()), float(probability)))
        keep = []
        for box, score in sorted(results, key=lambda item: -item[1]):
            if not any(overlap(box, found[0]) > 0.40 for found in keep):
                keep.append((box, score))
        return keep

    def scan(self, frame):
        return self.classify(frame, self.proposals(frame))
