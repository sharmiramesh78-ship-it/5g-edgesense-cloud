# 5G EdgeSense Cloud

Industrial IoT dashboard demo that streams clearly labeled simulated telemetry from three machines.

## Run & Operate

- Open the app preview at `/`; the `artifacts/edgesense-cloud: web` workflow serves the dashboard.
- The `artifacts/api-server: API Server` workflow serves FastAPI endpoints at `/api`.
- Standalone FastAPI run from the workspace root:
  `python -m uvicorn backend.main:app --app-dir artifacts/edgesense-cloud --host 0.0.0.0 --port 8000`
- Run API tests:
  `python -m unittest discover -s artifacts/edgesense-cloud/tests -v`
- Regenerate API clients after changing `lib/api-spec/openapi.yaml`:
  `pnpm --filter @workspace/api-spec run codegen`
- `pnpm run typecheck` checks the remaining TypeScript workspace packages.

## Stack

- Frontend: plain HTML, CSS, and browser JavaScript, served by the Vite web artifact.
- Backend: Python 3.11+, FastAPI, and Uvicorn.
- Telemetry is generated in memory; no database, device integration, cloud vendor, or paid service is used.
- The React files in the web artifact are unused scaffold files; the dashboard entry point is `artifacts/edgesense-cloud/index.html`.

## Where things live

- `artifacts/edgesense-cloud/backend/` — FastAPI app and simulator
- `artifacts/edgesense-cloud/static/` — dashboard styles and browser logic
- `artifacts/edgesense-cloud/tests/` — API tests
- `artifacts/edgesense-cloud/README.md` — setup, API, and test instructions
- `lib/api-spec/openapi.yaml` — generated API contract