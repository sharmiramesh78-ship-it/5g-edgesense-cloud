---
name: Artifact API routing
description: Replit workspace path routing behavior relevant to apps with both a root web artifact and the shared API artifact.
---

In this workspace, requests under `/api` are routed to the dedicated API artifact, even if the root web artifact also serves an endpoint at that path.

**Why:** A root FastAPI app initially served the dashboard, but the preview proxy sent its browser's `/api/*` requests to the existing API artifact. Keeping the dashboard at `/` and FastAPI endpoints in the `/api` service resolved the mismatch.

**How to apply:** For a root web artifact using the shared API path, keep the UI in the web service and run its API from the `/api` service. Smoke-test both paths through the shared preview proxy.