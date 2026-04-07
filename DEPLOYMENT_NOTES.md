# Quote API Deployment Notes

For future chat handoff and safe build workflow, read `BUILD_PLAN.md` first.

**Current state (Apr 7, 2026):**
- Deployed to Cloud Run service: `simply-tables-quote-api` (`us-central1`)
- Backend + frontend are in one container image
- FastAPI serves API routes at `/api/*`
- FastAPI serves React build output from `frontend/dist` at `/`
- Database: Cloud SQL PostgreSQL in `onyx-antler-483815-i1:us-central1:simply-tables-db`
- Startup currently uses `metadata.create_all` fallback behavior
- **NOT using strict Alembic-only migrations yet**
- **Phase 2 block architecture deployed** — per-product cost_blocks/labor_blocks replaced with quote-level quote_blocks + quote_block_members
- Quote Builder uses spreadsheet-style canvas (block rows × product columns)
- System defaults table stores app-level rate/margin defaults, inherited to new quotes and products

## Operational Requirements

1. `DATABASE_URL` must use async driver prefix:
	- ✅ `postgresql+asyncpg://...`
	- ❌ `postgresql+psycopg2://...` (causes runtime 500s with async engine)
2. CORS currently allows local frontend origins (localhost ports) and production host(s)
3. Frontend Docker build stage must install dev dependencies (`vite` is required at build time)
4. Cost block `fixed` semantics are intentional and should be preserved:
	- `cost_pp = cost_per_unit * units_per_product`
	- For flat costs, use `units_per_product = 1`
5. Phase 2 migration (`006_quote_block_architecture`) must be run before deploying this version:
	- Creates `system_defaults`, `quote_blocks`, `quote_block_members` tables
	- Adds default rate/margin columns to `quotes` table
	- Drops old tables: `cost_blocks`, `labor_blocks`, `group_cost_pools`, `group_cost_pool_members`, `group_labor_pools`, `group_labor_pool_members`
	- **WARNING:** This is a destructive migration — old block data will be lost. Run only after confirming no live data exists in old tables.

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

## Known Issue: Migration Drift on Existing Cloud SQL (Apr 7, 2026)

### Symptom

- API returned 500 on quote endpoints after deploy
- Logs showed missing columns on `quotes` and other tables
- Alembic `upgrade head` failed with duplicate table/index errors

### Root cause

- Database had partial schema created outside strict Alembic history
- Alembic revision chain had a mismatch in migration `005` (`Revises` pointed to `004` instead of the actual revision id)
- Local migration execution under Python 3.9 failed due to model type syntax (`X | None`)

### Safe recovery pattern that worked

1. Run migrations with Python 3.10+ (or newer) instead of Python 3.9.
2. Fix revision chain in `alembic/versions/005_add_rate_type_to_labor_blocks.py`:
	- `Revises: 004_add_stone_assignments`
	- `down_revision = "004_add_stone_assignments"`
3. Inspect schema drift versus models and add only missing columns with idempotent SQL (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`).
4. Stamp Alembic to current head only after schema and model are aligned.
5. Verify:
	- `alembic current` shows `005 (head)`
	- `/api/quotes` returns 200

### Prevention

- Do not rely on mixed `create_all` plus partial Alembic history for active schema evolution.
- Before running `alembic upgrade head` on an existing DB, check whether tables/columns already exist.
- Keep Alembic revision ids consistent and descriptive (avoid shorthand ids like `004` when actual ids are named).
- Plan credential rotation if any database URL/password appears in terminal output or logs.

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

## Phase 2 Migration Instructions

Before deploying the Phase 2 build:

```bash
# 1. Connect to Cloud SQL via proxy
cloud-sql-proxy onyx-antler-483815-i1:us-central1:simply-tables-db &

# 2. Run migration (requires Python 3.10+)
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/simply_tables \
  alembic upgrade head

# 3. Verify
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/simply_tables \
  alembic current
# Should show: 006_quote_block_architecture (head)

# 4. Deploy
gcloud run deploy simply-tables-quote-api --source . --region us-central1

# 5. Smoke test
curl -i "$base/api/quotes"
# Create quote → add products → blocks should auto-create → verify recalc
```

## Related files

- `alembic.ini` — migrations config (already set up)
- `alembic/env.py` — configured to read DATABASE_URL env var
- `app/database.py` — has `init_db()` fallback to metadata.create_all
- `app/main.py` — serves API routes and mounted frontend static build
- `app/routers/quote_blocks.py` — block CRUD + member management (Phase 2)
- `app/routers/defaults.py` — system defaults GET/PATCH (Phase 2)
- `frontend/` — React/Vite frontend source
- `Dockerfile` — multi-stage image build (frontend build + Python app runtime)
- Cloud Run service: `simply-tables-quote-api` (us-central1)
- GCP Project: `onyx-antler-483815-i1`
