# Build Plan and Handoff Guardrails

Last updated: 2026-04-06
Scope: simply-tables-quote-api

## Purpose

This document is the safe execution plan for future chats. Follow this order and these invariants to avoid regressions in calculation behavior, frontend UX, and deployment.

## Current Known-Good Baseline

- Service: simply-tables-quote-api (Cloud Run, us-central1)
- API prefix: /api
- Frontend served by FastAPI from frontend/dist at /
- Required DB driver: postgresql+asyncpg
- Product column order in UI is deterministic: sort_order, then id
- Cost block fixed semantics: cost_pp = cost_per_unit * units_per_product
- Phase 2 block architecture: quote_blocks + quote_block_members replace per-product blocks and group pools
- system_defaults → quote defaults → product: inheritance chain for rates/margins
- See deployment incident note: "Known Issue: Migration Drift on Existing Cloud SQL (Apr 7, 2026)" in DEPLOYMENT_NOTES.md before running migrations on an existing DB.
- Phase 2 migration (006) drops old block/pool tables — run only after confirming no live data

## Non-Negotiable Invariants

1. Never change fixed multiplier math without explicit approval.
2. Keep deterministic product ordering in the builder.
3. Keep frontend build stage installing dev dependencies (vite needed at build time).
4. Do not switch DATABASE_URL back to psycopg2 for async SQLAlchemy engine.
5. Preserve API route contract under /api unless migration plan is approved.
6. Pipelines (species, stone, rate labor) must not overwrite user-customized rates — only create blocks if missing.
7. System defaults → quote defaults → product defaults: each level is overridable but never auto-overwritten.

## Safe Change Workflow

1. Read these docs first:
- CLAUDE.md
- DEPLOYMENT_NOTES.md
- BUILD_PLAN.md

2. Confirm local baseline before edits:
- git status --short (must be understood before editing)
- npm run build in frontend
- Quick API health check in deployed env

3. Make smallest possible changes:
- Prefer targeted edits to existing files
- Avoid broad refactors unless requested
- Keep public API and response shapes stable

4. Validate locally after changes:
- frontend: npm run build
- backend: run lightweight endpoint checks (/health, /api/material-context, /api/quotes)

5. Commit discipline:
- Include relevant markdown updates in same commit
- Use clear commit message describing behavioral impact

6. Deployment verification after push:
- Confirm newest Cloud Run revision is Ready
- Verify live bundle contains expected new UI text/features
- Re-run health + key API endpoint checks

## Fast Verification Commands

From repo root:

```bash
git status --short
```

Frontend build:

```bash
cd frontend
npm run build
```

Live health checks:

```bash
base="https://simply-tables-quote-api-gxdcbpwqka-uc.a.run.app"
curl -i "$base/health"
curl -i "$base/api/material-context"
curl -i "$base/api/quotes"
```

Cloud Run revision check:

```bash
gcloud run services describe simply-tables-quote-api \
  --region us-central1 \
  --project onyx-antler-483815-i1 \
  --format='yaml(status.latestCreatedRevisionName,status.latestReadyRevisionName,status.url)'
```

## What Is Considered Up To Date

Operational docs are current when all of the following are true:
- CLAUDE.md matches active architecture and constraints
- DEPLOYMENT_NOTES.md matches real deploy behavior and known failure modes
- BUILD_PLAN.md reflects current safe workflow and invariants

Domain docs (Domain_Knowledge.md, Field_Reference.md, Quote_Sheet_Formula_Map.md) are reference snapshots. They should be updated when sheet-model understanding changes, not for every UI iteration.

## Handoff Checklist for Future Chats

1. Read CLAUDE.md, DEPLOYMENT_NOTES.md, BUILD_PLAN.md first.
2. Repeat back invariants before implementing risky edits.
3. Implement minimal change set.
4. Run build and endpoint checks.
5. Update markdown docs in same commit.
6. Push and verify active Cloud Run revision.
