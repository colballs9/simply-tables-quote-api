# Quote API Deployment Notes

**Current state (Apr 6, 2026):**
- Deployed to Cloud Run with `metadata.create_all` fallback
- **NOT using Alembic migrations yet** — using SQLAlchemy's automatic table creation
- Database: Cloud SQL PostgreSQL in `onyx-antler-483815-i1:us-central1:simply-tables-db`

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
- Cloud Run service: `simply-tables-quote-api` (us-central1)
- GCP Project: `onyx-antler-483815-i1`
