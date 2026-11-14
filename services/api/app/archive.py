"""Bounded storage for observations collected directly from the configured provider."""

from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sqlite3

from pydantic import TypeAdapter

from . import gate_events
from .rio import RioObservation
from .sptrans import Observation

OBSERVATION = TypeAdapter(Observation | RioObservation)

RETENTION_DAYS = 14
MAX_ROWS = 1_000_000
RECENT_SECONDS = 90


class ObservationArchive:
    def __init__(self, path: Path, scope: str, *, terminal_events: bool = False):
        self.path = path
        self.scope = scope
        self.terminal_events = terminal_events

    def initialize(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript("""
                CREATE TABLE IF NOT EXISTS observations (
                    scope TEXT NOT NULL,
                    observed TEXT NOT NULL,
                    vehicle TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    PRIMARY KEY (scope, observed, vehicle)
                ) WITHOUT ROWID;
                CREATE INDEX IF NOT EXISTS observations_age ON observations (observed);
                CREATE INDEX IF NOT EXISTS observations_vehicle
                    ON observations (scope, vehicle, observed DESC);
            """)
            if self.terminal_events:
                gate_events.initialize(db)

    def save(self, rows: list[Observation], now: datetime):
        cutoff = self.cutoff(now)
        recent = [row for row in rows if now - timedelta(seconds=RECENT_SECONDS) <= row.observedAt <= now]
        records = [
            (self.scope, self.stamp(row.observedAt), row.vehicleId, row.model_dump_json())
            for row in recent
        ]
        with closing(sqlite3.connect(self.path)) as db, db:
            db.executemany("INSERT OR IGNORE INTO observations VALUES (?, ?, ?, ?)", records)
            if self.terminal_events:
                for row in sorted(recent, key=lambda item: item.observedAt):
                    if isinstance(row, RioObservation):
                        gate_events.observe(db, self.scope, row, self.stamp(row.observedAt))
                gate_events.prune(db, self.stamp(now - gate_events.STATE_RETENTION),
                                  self.stamp(now - gate_events.EVENT_RETENTION))
            db.execute("DELETE FROM observations WHERE observed < ?", (cutoff,))
            overflow = db.execute("SELECT count(*) FROM observations").fetchone()[0] - MAX_ROWS
            if overflow > 0:
                db.execute("""
                    DELETE FROM observations WHERE (scope, observed, vehicle) IN (
                        SELECT scope, observed, vehicle FROM observations ORDER BY observed LIMIT ?
                    )
                """, (overflow,))

    def crossings(self, now: datetime):
        return gate_events.list_recent(self.path, self.scope, self.stamp(now - gate_events.EVENT_RETENTION))

    def bounds(self):
        cutoff = self.cutoff(datetime.now(timezone.utc))
        with closing(sqlite3.connect(self.path)) as db:
            first = db.execute(
                "SELECT observed FROM observations WHERE scope = ? AND observed >= ? ORDER BY observed LIMIT 1",
                (self.scope, cutoff),
            ).fetchone()
            last = db.execute(
                "SELECT observed FROM observations WHERE scope = ? AND observed >= ? ORDER BY observed DESC LIMIT 1",
                (self.scope, cutoff),
            ).fetchone()
        return (datetime.fromisoformat(first[0]), datetime.fromisoformat(last[0])) if first and last else None

    def snapshot(self, at: datetime):
        start = max(self.stamp(at - timedelta(seconds=RECENT_SECONDS)), self.cutoff(datetime.now(timezone.utc)))
        with closing(sqlite3.connect(self.path)) as db:
            rows = db.execute("""
                SELECT payload FROM observations
                WHERE scope = ? AND observed BETWEEN ? AND ?
                ORDER BY observed
            """, (self.scope, start, self.stamp(at)))
            latest = {}
            for (payload,) in rows:
                row = OBSERVATION.validate_json(payload)
                latest[row.vehicleId] = row
            return list(latest.values())

    def history(self, vehicle: str, at: datetime):
        with closing(sqlite3.connect(self.path)) as db:
            rows = db.execute("""
                SELECT payload FROM observations WHERE scope = ? AND vehicle = ? AND observed BETWEEN ? AND ?
                ORDER BY observed DESC LIMIT 20
            """, (self.scope, vehicle, self.cutoff(datetime.now(timezone.utc)), self.stamp(at)))
            return [OBSERVATION.validate_json(payload) for (payload,) in rows]

    @classmethod
    def cutoff(cls, now: datetime):
        return cls.stamp(now - timedelta(days=RETENTION_DAYS))

    @staticmethod
    def stamp(at: datetime):
        return at.astimezone(timezone.utc).isoformat(timespec="microseconds")
