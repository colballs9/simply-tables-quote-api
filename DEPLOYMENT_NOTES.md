# Quote API Deployment Notes

For future chat handoff and safe build workflow, read `BUILD_PLAN.md` first.

**Current state (Apr 9, 2026):**
- Deployed to Cloud Run service: `simply-tables-quote-api` (`us-central1`)
- Live service URL: `https://simply-tables-quote-api-442186711676.us-central1.run.app`
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
6. If rotating the Cloud SQL `postgres` password, redeploy Cloud Run in the same session with the updated `DATABASE_URL` or the service will lose DB connectivity.

## Verified Deploy Status (Apr 7, 2026)

- Cloud Run revision deployed successfully: `simply-tables-quote-api-00019-zs6`
- `GET /health` returned `200`
- `GET /api/defaults` returned `200`
- `GET /api/quotes` returned `200` after schema correction
- `POST /api/quotes` and `GET /api/quotes/{id}` both returned `200`

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
- Fresh `alembic upgrade head` after a full schema reset failed during `001_initial_schema_v1`

### Root cause

- Database had partial schema created outside strict Alembic history
- Local migration execution under Python 3.9 failed due to model type syntax (`X | None`)
- Installing full app requirements into a local Python 3.13 venv failed on `asyncpg` wheel build; Alembic-only tooling with `psycopg2-binary` worked
- `001_initial_schema_v1.py` splits `schema_v1.sql` on semicolons and skips chunks beginning with comments, which can skip valid SQL statements on a fresh DB
- App models expect `quotes.total_cost`, `quotes.total_price`, and `quotes.total_hours`, but those columns are not created by `schema_v1.sql` or later Alembic migrations

### Safe recovery pattern that worked

1. Use Python 3.10+ for Alembic commands; Python 3.9 cannot import the current models.
2. If the DB can be discarded, use a clean reset instead of trying to reconcile partial drift:
	- Drop and recreate `public` schema
	- Recreate `pgcrypto` extension
	- Load `schema_v1.sql` directly
	- `alembic stamp 001_initial_schema_v1`
	- `alembic upgrade head`
3. After migration, add missing quote total columns manually until a migration fixes this permanently:
	- `quotes.total_cost`
	- `quotes.total_price`
	- `quotes.total_hours`
4. Redeploy Cloud Run with `DATABASE_URL=postgresql+asyncpg://...` and the current Cloud SQL password.
5. Verify:
	- `alembic current` shows `006_quote_block_architecture (head)`
	- `/health`, `/api/defaults`, and `/api/quotes` all return `200`

### Prevention

- Do not rely on mixed `create_all` plus partial Alembic history for active schema evolution.
- Before running `alembic upgrade head` on an existing DB, check whether tables/columns already exist.
- Fix `001_initial_schema_v1.py` so it does not naively split `schema_v1.sql`.
- Add a real migration for `quotes.total_cost`, `quotes.total_price`, and `quotes.total_hours` so runtime schema matches ORM expectations.
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
cloud-sql-proxy onyx-antler-483815-i1:us-central1:simply-tables-db

# 2. Create local venv for Alembic if needed
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install alembic==1.16.5 sqlalchemy==2.0.35 psycopg2-binary==2.9.11

# 3. If DB contents are disposable, use the clean rebuild path
python - <<'PY'
import psycopg2
from pathlib import Path

dsn = 'postgresql://postgres:PASSWORD@127.0.0.1:5432/simply_tables'
schema_sql = Path('schema_v1.sql').read_text()

conn = psycopg2.connect(dsn)
conn.autocommit = True
cur = conn.cursor()
cur.execute('DROP SCHEMA IF EXISTS public CASCADE')
cur.execute('CREATE SCHEMA public')
cur.execute('GRANT ALL ON SCHEMA public TO postgres')
cur.execute('GRANT ALL ON SCHEMA public TO public')
cur.execute('CREATE EXTENSION IF NOT EXISTS pgcrypto')
cur.execute(schema_sql)
conn.close()
PY

# 4. Stamp base schema, then run Alembic to head
DATABASE_URL=postgresql://postgres:PASSWORD@127.0.0.1:5432/simply_tables \
	python -m alembic stamp 001_initial_schema_v1
DATABASE_URL=postgresql://postgres:PASSWORD@127.0.0.1:5432/simply_tables \
	python -m alembic upgrade head

# 5. Add missing runtime columns expected by ORM
python - <<'PY'
import psycopg2

conn = psycopg2.connect('postgresql://postgres:PASSWORD@127.0.0.1:5432/simply_tables')
conn.autocommit = True
cur = conn.cursor()
cur.execute('ALTER TABLE quotes ADD COLUMN IF NOT EXISTS total_cost NUMERIC(12,2)')
cur.execute('ALTER TABLE quotes ADD COLUMN IF NOT EXISTS total_price NUMERIC(12,2)')
cur.execute('ALTER TABLE quotes ADD COLUMN IF NOT EXISTS total_hours NUMERIC(10,2)')
conn.close()
PY

# 6. Verify migration state
DATABASE_URL=postgresql://postgres:PASSWORD@127.0.0.1:5432/simply_tables \
	python -m alembic current
# Should show: 006_quote_block_architecture (head)

# 7. Deploy with Cloud SQL binding and async driver
gcloud run deploy simply-tables-quote-api \
	--source . \
	--region us-central1 \
	--project onyx-antler-483815-i1 \
	--allow-unauthenticated \
	--add-cloudsql-instances=onyx-antler-483815-i1:us-central1:simply-tables-db \
	--set-env-vars="DATABASE_URL=postgresql+asyncpg://postgres:PASSWORD@/simply_tables?host=/cloudsql/onyx-antler-483815-i1:us-central1:simply-tables-db"

# 8. Smoke test
base="https://simply-tables-quote-api-442186711676.us-central1.run.app"
curl -i "$base/health"
curl -i "$base/api/defaults"
curl -i "$base/api/quotes"
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
