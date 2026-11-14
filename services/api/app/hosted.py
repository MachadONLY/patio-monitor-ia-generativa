"""Serve the production frontend and API from the same origin."""

import os
from pathlib import Path

from fastapi.staticfiles import StaticFiles

from .main import app

app.mount("/", StaticFiles(directory=Path(os.environ["PATIO_WEB_DIST"]), html=True), name="web")
