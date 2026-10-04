
FROM python:3.12-slim

WORKDIR /app

COPY artifacts/edgesense-cloud/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY artifacts/edgesense-cloud/backend/ ./backend/
COPY artifacts/edgesense-cloud/index.html .
COPY artifacts/edgesense-cloud/static/ ./static/

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
