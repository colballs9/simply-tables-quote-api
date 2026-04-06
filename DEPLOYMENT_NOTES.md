# Quote API Deployment Notes

**Current state (Apr 6, 2026):**
- Deployed to Cloud Run service: `simply-tables-quote-api` (`us-central1`)
- Backend + frontend are in one container image
- FastAPI serves API routes at `/api/*`
- FastAPI serves React build output from `frontend/dist` at `/`
- Database: Cloud SQL PostgreSQL in `onyx-antler-483815-i1:us-central1:simply-tables-db`
- Startup currently uses `metadata.create_all` fallback behavior
- **NOT using strict Alembic-only migrations yet**
- Quote Builder product columns are rendered in deterministic order (`sort_order`, then `id`) to prevent column swapping during edits
- Product editor is now sectioned into: General Specs, Descriptions, Cost Blocks, Labor Blocks, and Final Pricing

## Operational Requirements

1. `DATABASE_URL` must use async driver prefix:
	- ✅ `postgresql+asyncpg://...`
	- ❌ `postgresql+psycopg2://...` (causes runtime 500s with async engine)
2. CORS currently allows local frontend origins (localhost ports) and production host(s)
3. Frontend Docker build stage must install dev dependencies (`vite` is required at build time)
4. Cost block `fixed` semantics are intentional and should be preserved:
	- `cost_pp = cost_per_unit * units_per_product`
	- For flat costs, use `units_per_product = 1`

## Cloud Build Troubleshooting

### Symptom

Build fails with:

```text
sh: 1: vite: not found
```

### Cause

Frontend builder used production-only dependency install (`npm ci --omit=dev`), which skips `vite`.

### Fix

Use full dependency install in the frontend builder stage:

```dockerfile
RUN npm ci || npm install
```

## ⚠️ Action Items

1. **Once app is stable and working**, transition to proper Alembic migrations
2. Create initial migration that captures current schema from `schema_v1.sql`
3. Lock down future schema changes via versioned migrations
4. This is critical for active development — allows rollbacks, collaboration, audit trail

## Why this approach?

`metadata.create_all` is **only safe for initial deployment**:
- ✅ Quick way to get tables created on first startup
- ❌ Dangerous for schema changes (no rollback capability, hard to track)
- ❌ Not suitable for active development with team

## Proper workflow (when ready)

```bash
# Modify app/models.py
# Then:
alembic revision --autogenerate -m "describe your change"
# Review the migration file
git add alembic/versions/
git commit
git push  # Auto-deploys to Cloud Run, which runs migrations
```

## Related files

- `alembic.ini` — migrations config (already set up)
- `alembic/env.py` — configured to read DATABASE_URL env var
- `app/database.py` — has `init_db()` fallback to metadata.create_all
- `app/main.py` — serves API routes and mounted frontend static build
- `frontend/` — React/Vite frontend source
- `Dockerfile` — multi-stage image build (frontend build + Python app runtime)
- Cloud Run service: `simply-tables-quote-api` (us-central1)
- GCP Project: `onyx-antler-483815-i1`
