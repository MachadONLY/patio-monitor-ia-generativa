"""Reproducibility guard for intermittent upstream video rate limiting."""
from urllib.error import HTTPError
import pytest
from services.vision import train


class Download:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, trace):
        return False

    def read(self, limit):
        return b"licensed-original-video"[:limit]


def test_rate_limit_is_retried_without_mutating_source(monkeypatch):
    requests = []
    delays = []

    def fetch(request, timeout):
        requests.append(request)
        if len(requests) < 3:
            raise HTTPError("https://example.org/source.webm", 429, "Too many requests",
                            {"Retry-After": "1"}, None)
        return Download()

    monkeypatch.setattr(train, "urlopen", fetch)
    monkeypatch.setattr(train, "sleep", delays.append)
    result = train.read_verified_source("https://example.org/source.webm", 1024)
    assert result == b"licensed-original-video"
    assert len(requests) == 3
    assert delays == [1, 1]


def test_persistent_rate_limit_stays_an_error(monkeypatch):
    attempts = []
    monkeypatch.setattr(train, "sleep", lambda delay: None)

    def denied(request, timeout):
        attempts.append(request)
        raise HTTPError("https://example.org/source.webm", 429, "Too many requests", {}, None)

    monkeypatch.setattr(train, "urlopen", denied)
    with pytest.raises(HTTPError) as caught:
        train.read_verified_source("https://example.org/source.webm", 1024)
    assert caught.value.code == 429
    assert len(attempts) == 4
