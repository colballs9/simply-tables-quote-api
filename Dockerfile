# ── Stage 1: build React frontend ───────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --omit=dev || npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python API + serve built frontend ───────────────────────────────
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY calc_engine.py .
COPY schema_v1.sql .
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .

# Copy built frontend from stage 1
COPY --from=frontend-builder /frontend/dist ./frontend/dist

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
