"""In-memory temperature telemetry generator for the dashboard demo."""

from __future__ import annotations

import math
import random
import threading
from datetime import datetime, timedelta, timezone
from typing import Any


SAMPLE_INTERVAL_SECONDS = 3
HISTORY_LIMIT = 1_800


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def as_iso(value: datetime) -> str:
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


class TelemetrySimulator:
    """Maintains a small, thread-safe in-memory stream of simulated machine data."""

    def __init__(self, seed: int = 17) -> None:
        self._random = random.Random(seed)
        self._lock = threading.RLock()
        self._machine_config = [
            {
                "id": "MCH-001",
                "name": "Hydraulic Press 01",
                "location": "Production line A",
                "threshold_c": 84.0,
                "baseline_c": 71.4,
                "signal_strength": 97,
            },
            {
                "id": "MCH-002",
                "name": "CNC Mill 02",
                "location": "Precision cell B",
                "threshold_c": 82.0,
                "baseline_c": 83.8,
                "signal_strength": 92,
            },
            {
                "id": "MCH-003",
                "name": "Thermal Oven 03",
                "location": "Finishing line C",
                "threshold_c": 94.0,
                "baseline_c": 68.7,
                "signal_strength": 95,
            },
        ]
        self._machines: dict[str, dict[str, Any]] = {}
        self._readings: dict[str, list[dict[str, Any]]] = {}
        self._alerts: list[dict[str, Any]] = []
        self._next_alert_id = 1
        self._initialize_history()

    def _initialize_history(self) -> None:
        now = utc_now()
        with self._lock:
            for config in self._machine_config:
                machine_id = config["id"]
                history: list[dict[str, Any]] = []
                for index in range(20):
                    wave = math.sin(index / 3.2) * 0.55
                    drift = (index / 19) * 0.3
                    temperature = round(config["baseline_c"] + wave + drift, 1)
                    timestamp = now - timedelta(
                        seconds=SAMPLE_INTERVAL_SECONDS * (19 - index)
                    )
                    history.append(
                        {
                            "machine_id": machine_id,
                            "temperature_c": temperature,
                            "timestamp": as_iso(timestamp),
                        }
                    )

                current_temperature = history[-1]["temperature_c"]
                self._readings[machine_id] = history
                self._machines[machine_id] = {
                    "id": machine_id,
                    "name": config["name"],
                    "location": config["location"],
                    "status": (
                        "warning"
                        if current_temperature >= config["threshold_c"]
                        else "normal"
                    ),
                    "connectivity": "connected",
                    "temperature_c": current_temperature,
                    "threshold_c": config["threshold_c"],
                    "last_updated": history[-1]["timestamp"],
                    "signal_strength": config["signal_strength"],
                }
                if current_temperature >= config["threshold_c"]:
                    self._create_alert(self._machines[machine_id], now)

    def tick(self, at: datetime | None = None) -> None:
        """Generate one reading per machine and emit alerts on threshold crossings."""
        timestamp = at or utc_now()
        with self._lock:
            for config in self._machine_config:
                machine_id = config["id"]
                machine = self._machines[machine_id]
                was_warning = machine["status"] == "warning"
                previous = machine["temperature_c"]
                baseline = config["baseline_c"]
                # A weak pull toward the machine's operating temperature with
                # small noise keeps the stream organic without unbounded drift.
                next_temperature = previous + (baseline - previous) * 0.14
                next_temperature += self._random.uniform(-0.45, 0.45)
                next_temperature = round(next_temperature, 1)
                is_warning = next_temperature >= config["threshold_c"]

                machine.update(
                    {
                        "status": "warning" if is_warning else "normal",
                        "temperature_c": next_temperature,
                        "last_updated": as_iso(timestamp),
                        "signal_strength": max(
                            80,
                            min(
                                100,
                                machine["signal_strength"]
                                + self._random.choice([-1, 0, 0, 1]),
                            ),
                        ),
                    }
                )
                self._readings[machine_id].append(
                    {
                        "machine_id": machine_id,
                        "temperature_c": next_temperature,
                        "timestamp": as_iso(timestamp),
                    }
                )
                if len(self._readings[machine_id]) > HISTORY_LIMIT:
                    del self._readings[machine_id][:-HISTORY_LIMIT]

                if is_warning and not was_warning:
                    self._create_alert(machine, timestamp)

    def _create_alert(self, machine: dict[str, Any], timestamp: datetime) -> None:
        self._alerts.insert(
            0,
            {
                "id": f"ALT-{self._next_alert_id:04d}",
                "machine_id": machine["id"],
                "machine_name": machine["name"],
                "message": (
                    f"{machine['name']} exceeded its "
                    f"{machine['threshold_c']:.0f}°C temperature threshold"
                ),
                "severity": "critical",
                "temperature_c": machine["temperature_c"],
                "timestamp": as_iso(timestamp),
                "acknowledged": False,
            },
        )
        self._next_alert_id += 1
        del self._alerts[100:]

    def get_machines(self) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(machine) for machine in self._machines.values()]

    def get_readings(self, limit: int = 60) -> list[dict[str, Any]]:
        with self._lock:
            readings = [
                dict(reading)
                for history in self._readings.values()
                for reading in history[-limit:]
            ]
        return sorted(readings, key=lambda reading: reading["timestamp"])

    def get_alerts(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(alert) for alert in self._alerts[:limit]]

    def get_dashboard(self) -> dict[str, Any]:
        machines = self.get_machines()
        alerts = self.get_alerts(20)
        readings = self.get_readings(60)
        connected = sum(machine["connectivity"] == "connected" for machine in machines)
        active_alerts = sum(machine["status"] == "warning" for machine in machines)
        average = round(
            sum(machine["temperature_c"] for machine in machines) / len(machines), 1
        )
        return {
            "summary": {
                "total_machines": len(machines),
                "connected_machines": connected,
                "online_machines": connected,
                "active_alerts": active_alerts,
                "avg_temperature_c": average,
            },
            "machines": machines,
            "readings": readings,
            "alerts": alerts,
            "updated_at": as_iso(utc_now()),
            "simulated": True,
        }