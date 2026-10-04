import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

APP_DIRECTORY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP_DIRECTORY))

from backend.main import app  # noqa: E402


class DashboardApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client_context = TestClient(app)
        self.client = self.client_context.__enter__()

    def tearDown(self) -> None:
        self.client_context.__exit__(None, None, None)

    def test_dashboard_has_three_simulated_machines_and_a_warning(self) -> None:
        response = self.client.get("/api/dashboard")
        self.assertEqual(response.status_code, 200)

        dashboard = response.json()
        self.assertTrue(dashboard["simulated"])
        self.assertEqual(dashboard["summary"]["total_machines"], 3)
        self.assertEqual(len(dashboard["machines"]), 3)
        self.assertTrue(
            any(machine["status"] == "warning" for machine in dashboard["machines"])
        )
        self.assertTrue(dashboard["alerts"])

    def test_readings_are_grouped_across_all_machines(self) -> None:
        response = self.client.get("/api/readings?limit=4")
        self.assertEqual(response.status_code, 200)

        readings = response.json()
        self.assertEqual(len(readings), 12)
        self.assertEqual(
            {reading["machine_id"] for reading in readings},
            {"MCH-001", "MCH-002", "MCH-003"},
        )

    def test_alert_and_health_endpoints(self) -> None:
        health = self.client.get("/api/healthz")
        alerts = self.client.get("/api/alerts?limit=1")
        self.assertEqual(health.json(), {"status": "healthy"})
        self.assertEqual(alerts.status_code, 200)
        self.assertEqual(len(alerts.json()), 1)
        self.assertEqual(alerts.json()[0]["severity"], "critical")

    def test_query_limits_are_validated(self) -> None:
        response = self.client.get("/api/readings?limit=0")
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()