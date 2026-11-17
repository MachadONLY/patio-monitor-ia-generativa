"""Infer GPS perimeter crossings without treating them as gate transactions."""

from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timedelta
import json
import math
from pathlib import Path
import sqlite3

from .rio import RioObservation

PERIMETER = json.loads(Path(__file__).with_name("alvorada-perimeter.json").read_text(encoding="utf-8"))
TERMINAL_CENTER = (-43.3664, -23.0014)
BOUNDARY_BUFFER_METERS = 15
MAX_GAP = timedelta(seconds=90)
MAX_SPEED_MPS = 33.33
STATE_RETENTION = timedelta(minutes=15)
EVENT_RETENTION = timedelta(days=14)
MAX_EVENTS = 10_000
MAX_TRACKED_VEHICLES = 5_000
MAX_LIST = 40


def project(longitude: float, latitude: float) -> tuple[float, float]:
    x = (longitude - TERMINAL_CENTER[0]) * 111_320 * math.cos(math.radians(TERMINAL_CENTER[1]))
    y = (latitude - TERMINAL_CENTER[1]) * 111_320
    return x, y


RING = [project(*point) for point in PERIMETER["ring"]]
BOUNDS = (
    min(point[0] for point in RING), min(point[1] for point in RING),
    max(point[0] for point in RING), max(point[1] for point in RING),
)


def coverage_sample() -> list[tuple[float, float]]:
    """Require the extraction area to include the terminal and its approach."""
    longitude, latitude = map(list, zip(*PERIMETER["ring"]))
    margin = 0.0004
    west, east = min(longitude) - margin, max(longitude) + margin
    south, north = min(latitude) - margin, max(latitude) + margin
    return [TERMINAL_CENTER, (west, south), (west, north), (east, south), (east, north)]


def classify(x: float, y: float) -> str | None:
    """Ignore the uncertainty band, using metres rather than angular degrees."""
    west, south, east, north = BOUNDS
    if not (west - BOUNDARY_BUFFER_METERS <= x <= east + BOUNDARY_BUFFER_METERS
            and south - BOUNDARY_BUFFER_METERS <= y <= north + BOUNDARY_BUFFER_METERS):
        return "outside"
    inside = False
    for (ax, ay), (bx, by) in zip(RING, RING[1:]):
        dx, dy = bx - ax, by - ay
        length_squared = dx * dx + dy * dy
        if length_squared == 0:
            continue
        ratio = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / length_squared))
        if (x - ax - ratio * dx) ** 2 + (y - ay - ratio * dy) ** 2 <= BOUNDARY_BUFFER_METERS ** 2:
            return None
        if (ay > y) != (by > y) and x < ax + dx * (y - ay) / dy:
            inside = not inside
    return "inside" if inside else "outside"


@dataclass
class CrossingState:
    last_at: str
    last_x: float
    last_y: float
    stable_side: str | None = None
    stable_at: str | None = None
    candidate_side: str | None = None
    candidate_at: str | None = None


def initialize(db: sqlite3.Connection) -> None:
    db.executescript("""
        CREATE TABLE IF NOT EXISTS terminal_crossing_state (
            scope TEXT NOT NULL,
            vehicle TEXT NOT NULL,
            last_at TEXT NOT NULL,
            last_x REAL NOT NULL,
            last_y REAL NOT NULL,
            stable_side TEXT,
            stable_at TEXT,
            candidate_side TEXT,
            candidate_at TEXT,
            PRIMARY KEY (scope, vehicle)
        ) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS terminal_crossings (
            scope TEXT NOT NULL,
            vehicle TEXT NOT NULL,
            kind TEXT NOT NULL,
            interval_start TEXT NOT NULL,
            interval_end TEXT NOT NULL,
            confirmed_at TEXT NOT NULL,
            line TEXT,
            PRIMARY KEY (scope, confirmed_at, vehicle)
        ) WITHOUT ROWID;
        CREATE INDEX IF NOT EXISTS terminal_crossings_age ON terminal_crossings (confirmed_at);
        CREATE INDEX IF NOT EXISTS terminal_crossing_state_age ON terminal_crossing_state (last_at);
    """)


def observe(db: sqlite3.Connection, scope: str, row: RioObservation, at: str) -> None:
    saved = db.execute("""
        SELECT last_at, last_x, last_y, stable_side, stable_at, candidate_side, candidate_at
        FROM terminal_crossing_state WHERE scope = ? AND vehicle = ?
    """, (scope, row.vehicleId)).fetchone()
    x, y = project(row.longitude, row.latitude)
    state = CrossingState(at, x, y)
    if saved:
        state = CrossingState(*saved)
        if at <= state.last_at:
            return
        last_gap = row.observedAt - datetime.fromisoformat(state.last_at)
        allowable_displacement = last_gap.total_seconds() * MAX_SPEED_MPS + 2 * BOUNDARY_BUFFER_METERS
        if last_gap > MAX_GAP or math.hypot(x - state.last_x, y - state.last_y) > allowable_displacement:
            state = CrossingState(at, x, y)
    state.last_at, state.last_x, state.last_y = at, x, y

    side = classify(x, y)
    # An uncertain fix breaks confirmation and never replaces the last trusted side.
    if side is None or side == state.stable_side:
        state.candidate_side = state.candidate_at = None
        if side is not None:
            state.stable_at = at
    elif side != state.candidate_side:
        state.candidate_side, state.candidate_at = side, at
    else:
        if state.stable_at and state.candidate_at:
            crossing_gap = datetime.fromisoformat(state.candidate_at) - datetime.fromisoformat(state.stable_at)
            if crossing_gap <= MAX_GAP:
                kind = "entry" if side == "inside" else "exit"
                db.execute("""
                    INSERT OR IGNORE INTO terminal_crossings
                    (scope, vehicle, kind, interval_start, interval_end, confirmed_at, line)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (scope, row.vehicleId, kind, state.stable_at, state.candidate_at, at, row.lineLabel))
        state.stable_side, state.stable_at = side, at
        state.candidate_side = state.candidate_at = None

    db.execute("""
        INSERT OR REPLACE INTO terminal_crossing_state
        (scope, vehicle, last_at, last_x, last_y, stable_side, stable_at, candidate_side, candidate_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (scope, row.vehicleId, state.last_at, state.last_x, state.last_y,
          state.stable_side, state.stable_at, state.candidate_side, state.candidate_at))


def prune(db: sqlite3.Connection, state_cutoff: str, event_cutoff: str) -> None:
    db.execute("DELETE FROM terminal_crossing_state WHERE last_at < ?", (state_cutoff,))
    db.execute("DELETE FROM terminal_crossings WHERE confirmed_at < ?", (event_cutoff,))
    tracked_overflow = db.execute("SELECT count(*) FROM terminal_crossing_state").fetchone()[0] - MAX_TRACKED_VEHICLES
    if tracked_overflow > 0:
        db.execute("""
            DELETE FROM terminal_crossing_state WHERE (scope, vehicle) IN (
                SELECT scope, vehicle FROM terminal_crossing_state ORDER BY last_at LIMIT ?
            )
        """, (tracked_overflow,))
    overflow = db.execute("SELECT count(*) FROM terminal_crossings").fetchone()[0] - MAX_EVENTS
    if overflow > 0:
        db.execute("""
            DELETE FROM terminal_crossings WHERE (scope, confirmed_at, vehicle) IN (
                SELECT scope, confirmed_at, vehicle FROM terminal_crossings ORDER BY confirmed_at LIMIT ?
            )
        """, (overflow,))


def list_recent(path: Path, scope: str, cutoff: str) -> list[dict]:
    with closing(sqlite3.connect(path)) as db:
        rows = db.execute("""
            SELECT vehicle, kind, interval_start, interval_end, confirmed_at, line
            FROM terminal_crossings
            WHERE scope = ? AND confirmed_at >= ?
            ORDER BY confirmed_at DESC, vehicle
            LIMIT ?
        """, (scope, cutoff, MAX_LIST))
        return [
            {"id": f"{vehicle}:{confirmed_at}", "vehicleId": vehicle, "kind": kind, "line": line,
             "betweenFrom": start, "betweenTo": end, "confirmedAt": confirmed_at}
            for vehicle, kind, start, end, confirmed_at, line in rows
        ]

def summary_recent(path: Path, scope: str, cutoff: str) -> dict:
    """Summarize confirmed GPS perimeter crossings, never physical gate transactions."""
    with closing(sqlite3.connect(path)) as db:
        rows = db.execute("""
            SELECT vehicle, kind, confirmed_at FROM terminal_crossings
            WHERE scope = ? AND confirmed_at >= ?
            ORDER BY confirmed_at ASC, vehicle
        """, (scope, cutoff)).fetchall()
    entry_at: dict[str, datetime] = {}
    durations_minutes: list[float] = []
    entries = exits = 0
    for vehicle, kind, when in rows:
        at = datetime.fromisoformat(when)
        if kind == "entry":
            entries += 1
            entry_at[vehicle] = at
        elif kind == "exit":
            exits += 1
            prior = entry_at.pop(vehicle, None)
            if prior is not None:
                minutes = (at - prior).total_seconds() / 60
                if 0 <= minutes <= 24 * 60:
                    durations_minutes.append(minutes)
    return {
        "windowHours": 24,
        "entries": entries,
        "exits": exits,
        "paired": len(durations_minutes),
        "averageMinutes": round(sum(durations_minutes) / len(durations_minutes), 1)
            if durations_minutes else None,
    }
