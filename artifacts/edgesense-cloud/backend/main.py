"""FastAPI application for the 5G EdgeSense Cloud simulator."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .simulator import SAMPLE_INTERVAL_SECONDS, TelemetrySimulator


APP_ROOT = Path(__file__).resolve().parent.parent
STATIC_ROOT = APP_ROOT / "static"
INDEX_FILE = APP_ROOT / "index.html"
simulator = TelemetrySimulator()


async def generate_readings() -> None:
    while True:
        await asyncio.sleep(SAMPLE_INTERVAL_SECONDS)
        simulator.tick()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    task = asyncio.create_task(generate_readings())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title="5G EdgeSense Cloud",
    description="A dashboard backed by clearly labeled simulated machine telemetry.",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)
app.mount("/static", StaticFiles(directory=STATIC_ROOT, check_dir=False), name="static")


@app.get("/", include_in_schema=False)
def home() -> FileResponse:
    return FileResponse(INDEX_FILE)


@app.get("/api/healthz")
def health_check() -> dict[str, str]:
    return {"status": "healthy"}


@app.get("/api/dashboard")
def dashboard() -> dict:
    return simulator.get_dashboard()


@app.get("/api/machines")
def machines() -> list[dict]:
    return simulator.get_machines()


@app.get("/api/readings")
def readings(
    limit: int = Query(default=60, ge=1, le=300),
) -> list[dict]:
    return simulator.get_readings(limit)


@app.get("/api/alerts")
def alerts(
    limit: int = Query(default=20, ge=1, le=100),
) -> list[dict]:
    return simulator.get_alerts(limit)