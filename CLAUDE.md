# CLAUDE.md — Simply Tables Web Quote System

## What This Project Is

A web-based quoting tool for **Simply Tables**, a custom furniture manufacturing business. This replaces (and will eventually supersede) a Google Sheets-based quoting system that has 1,682 rows of formulas across 22 columns.

**Owner:** Colin Kettler  
**Stack:** Python (FastAPI) + PostgreSQL + React (Vite)  
**Hosting:** Google Cloud Platform (Cloud Run + Cloud SQL)  
**GCP Project:** `onyx-antler-483815-i1` (same project as the existing procurement automation service)  
**Region:** `us-central1`

## Read This First (Agent Handoff)

Before making changes, read in this order:

1. `CLAUDE.md`
2. `DEPLOYMENT_NOTES.md`
3. `BUILD_PLAN.md`

---

## Build Rules — FOLLOW THESE EXACTLY

These rules exist because we've hit these bugs multiple times. Every new component, input, endpoint, or agent-built code MUST follow them.

### Frontend Input Rules

1. **NEVER save on every keystroke.** Every text and number input MUST use local state (`useState`) and save on blur (`onBlur`). The `onChange` handler only updates local state — never calls an API. Selects (`<select>`) are the ONE exception (single action, not per-keystroke).

2. **ALWAYS use the `useSpreadsheetInput` hook** (`frontend/src/hooks/useSpreadsheetInput.js`) on every text and number input. It provides:
   - `onFocus`: selects all text (click to replace, like a spreadsheet cell)
   - `onKeyDown`: Enter commits (blurs), Escape reverts to original value and blurs
   - Wire it: `onFocus={e => { focusRef.current = field; ss.onFocus(e) }}` and `onKeyDown={ss.onKeyDown}`

3. **ALWAYS use a focusRef guard** to prevent API responses from overwriting the input the user is actively typing in. Pattern:
   ```jsx
   const focusRef = useRef(null)
   // On focus: focusRef.current = fieldName
   // On blur: focusRef.current = null
   // When syncing from props: skip if focusRef.current === fieldName
   ```

4. **Sync from props only when identity changes or field is NOT focused.** Use a `prevIdRef` to detect when the parent object (product, block) changes identity. Use the focusRef to skip syncing focused fields. Never use `useEffect` with prop values as deps for input sync — it fires too often and causes flicker.

5. **Product column inputs** use `PcolText`, `PcolNum`, `PcolSelect` sub-components in `ProductColumn.jsx`. Follow their pattern for any new product fields.

### Frontend Mutation Rules

6. **Checkbox race condition protection.** `QuoteBuilder.refreshQuote` applies the mutation response immediately, then schedules a debounced re-fetch (300ms) to catch concurrent mutations. All mutation callbacks flow through this — never bypass it with a direct `setQuote()`.

7. **Block member toggles** use a `toggling` state to prevent concurrent toggles within the same block. See `BlockRow.jsx`.

### Backend Async Rules

8. **NEVER access an ORM relationship on an object fetched with bare `db.get()`.** It triggers a synchronous lazy load which crashes with `MissingGreenlet` in async SQLAlchemy + asyncpg. Always use `selectinload()` in the query, or query the child table directly.

9. **After pipelines create new blocks/members, ALWAYS flush and reload** the full quote via `load_full_quote()` before passing to the calc engine. New blocks appended to `quote.quote_blocks` don't have their `members` relationship eagerly loaded — iterating them crashes.

10. **Never call `block.members.append(m)` on a newly created block** in async context. Use `db.add(m)` with the foreign key set — the relationship will be populated on the next `load_full_quote()` call.

### General Build Rules

11. **Test before pushing.** Run `python3 -m pytest test_calc_engine.py -q` and `npx vite build` (in `frontend/`). Both must pass clean.

12. **Stable sorting.** Product and block lists must use `sort_order` then `id` (string compare) for deterministic order. Use `useMemo` to prevent unnecessary re-renders from re-sorting on every render.

13. **Material fields.** "Material Group" = the type (Hardwood, Stone, etc). "Material" = the specific species/stone (Walnut, Quartz, etc). Use `MaterialSearch` component for the Material field with autocomplete from `material_context` API.

---

## Current State

### What's Built (April 2026)

Core layers are live and actively deployed:

1. **Database Schema** (`schema_v1.sql`) — Cloud SQL Postgres backing the API
2. **Calculation Engine** (`calc_engine.py`) — Production API uses this engine for recalculation
3. **FastAPI Backend** (`app/`) — Deployed on Cloud Run (`simply-tables-quote-api`)
4. **React Frontend** (`frontend/`) — Built in Docker and served by FastAPI from `frontend/dist`

### Current Deployment Reality

1. Cloud Run service exists: `simply-tables-quote-api` (`us-central1`)
2. API routes are under `/api/*`
3. Frontend is served from `/` by FastAPI static mount
4. Health endpoint: `/health`
5. DATABASE_URL must use the async driver form: `postgresql+asyncpg://...`
6. **Phase 2 block architecture active** — `quote_blocks` + `quote_block_members` replace old per-product `cost_blocks`/`labor_blocks` and `group_cost_pools`/`group_labor_pools`
7. `system_defaults` table stores app-level rate/margin defaults, inherited to quotes then products
8. Products rendered in deterministic order (`sort_order`, then `id`)

### What Needs To Happen Next

1. Run migration 006 on Cloud SQL before deploying Phase 2 build
2. Populate/maintain reference tables (material context, base catalog)
3. Transition from `metadata.create_all` bootstrap pattern to strict Alembic migration workflow
4. Add regression tests for API + frontend integration paths
5. Build catalog/settings pages
6. Product detail editing (click product header to open spec editor)

### Frontend UX Notes (Current)

1. Quote Builder uses a spreadsheet-style canvas: block rows × product columns
2. Cost blocks and labor blocks are managed at the quote level with per-product membership
3. Built-in blocks (species, stone, rate labor) are auto-created by pipelines — users edit rates, not block structure
4. Side panel shows summary, shipping, and shared pool management
5. Cost block `fixed` semantics: `cost_pp = cost_per_unit * units_per_product`

---

## Existing GCP Infrastructure

There is already a Cloud Run service in this project for procurement automation:

- **Service:** `procurement-quote`
- **URL:** `https://procurement-quote-442186711676.us-central1.run.app`
- **Service Account:** `procurement-automation@onyx-antler-483815-i1.iam.gserviceaccount.com`
- **Region:** `us-central1`
- **Auth pattern:** Public URL + secret token header
- **Org policy note:** `iam.allowedPolicyMemberDomains` required a project-level override for `allUsers` access — this should already be in place from the procurement setup

The quote API should be a **separate Cloud Run service** in the same project, potentially with its own service account.

### Cloud Run Deploy Pattern (quote service)

```bash
gcloud run deploy quote-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="DATABASE_URL=postgresql+asyncpg://postgres:PASSWORD@/simply_tables?host=/cloudsql/onyx-antler-483815-i1:us-central1:INSTANCE_NAME"
```

Note: `--timeout=900` and env vars persist between `--source .` redeployments.

### Cloud Build Note (frontend)

When building frontend assets in Docker, the builder stage must install **dev dependencies** (`vite` is a dev dependency). Use:

```dockerfile
RUN npm ci || npm install
```

Do not use `npm ci --omit=dev` in the frontend build stage.

---

## Architecture Decisions (and Why)

These decisions were made in conversation with Colin. They are intentional and should not be changed without discussion.

### Dynamic blocks, not fixed slots
The Google Sheet has fixed slots (UC1-UC9, GC1-GC6, UH1-UH2 per labor center). The web app creates blocks **on demand** — start with zero, add as needed via "New Unit Cost" / "New Group Cost" buttons. This eliminates scrolling through empty slots.

### All blocks live at the quote level (Phase 2)
Cost and labor blocks are defined at the quote level (`quote_blocks` table) with per-product membership via `quote_block_members`. This replaced the earlier design where blocks lived on individual products. Benefits:
- Spreadsheet-style canvas: blocks as rows, products as columns
- Group blocks (distribute lump sums) and unit/rate blocks use the same table
- Per-member overrides (cost_per_unit, hours_per_unit, is_active) allow product-specific values
- Built-in blocks are auto-created by pipelines (species, stone, rate labor) — users customize rates, not structure

### `on_qty_change` flag on group pools
When a product's quantity changes after a group pool was set up, Colin wants to choose:
- `redistribute` — keep the total amount, re-slice it across products
- `recalculate` — update the total based on new quantities
The app should warn when this situation occurs.

### Tags on every block
Every cost block and labor block has an optional `tag_id`. Tags like "Top", "Base", "Shipping", "Feature: Edge Band" enable instant price breakdowns by component. The sheet only had tags on labor hours (4 fixed options). The web app makes tags open-ended and puts them on costs too.

### Quote options
A quote can have multiple options (e.g., "Option A: Ash", "Option B: Walnut"). Products belong to an option, not directly to a quote. Most quotes have one option (auto-created, invisible in UI). The cloning/comparison UI comes later.

### Product groups
Products within an option can have an optional `product_group` label (e.g., "Dining Tables", "Bar Tops"). This is a UI organization tool, not a structural relationship. Presets can be batch-applied to all products in a group.

### Rep defaults to TRUE
`has_rep` on the quotes table defaults to `true` (most jobs have a rep). Rep rate defaults to 8%.

### Material context drives the UI
The `material_context` table tells the frontend what to show for each material type — which spec fields are relevant, what dropdown options to offer, which labor centers to auto-create, default margin rates. When you pick "Hardwood", the UI narrows to hardwood-relevant fields. When you pick "Stone", it shows a completely different set.

### Auto-recalculation on every input change
Every write endpoint (product update, add cost block, change pool amount, etc.) calls `recalculate_quote()` which:
1. Loads the entire quote graph from Postgres (eager loading)
2. Converts to dict format
3. Runs the calc engine
4. Writes all computed values back to the database
5. Returns the full updated quote

The frontend never computes. It reads computed values from the API.

### Presets capture any subset
A preset can include product specs, cost blocks, labor blocks, or any combination. "Save selection as preset" writes to `presets` + `preset_blocks`. A preset applied to a product creates new blocks on that product. This is more flexible than the sheet's column-per-preset approach.

### Future: Claude intelligence
The schema is designed so historical quotes become training data. Once enough quotes are stored, Claude can query similar products (by material type, size range, base type) and suggest hours, presets, and pricing based on historical patterns. No special tables needed — just queries against `products`, `quote_blocks`, and `quote_block_members`.

---

## Calculation Engine — How It Works

The engine (`calc_engine.py`) is a set of pure functions. No database calls, no side effects. It receives data dicts and returns computed results.

### Aggregation hierarchy (same as the sheet):
```
PU/PB → PP → PT → Option Total → Quote Total

PU = Per Unit (single piece)
PB = Per Base (single base)
PP = Per Product (per table) — the fundamental level
PT = Product Total (PP × Quantity)
```

### Three block patterns:

1. **Unit Block:** `value × multiplier → PP → PT`
   - Multiplier types: fixed, per_base, per_sqft, per_bdft

2. **Group Block:** `lump_sum ÷ proportional_metric → PP`
   - Distribution types: units, sqft, bdft
   - Rate = total / sum(all member metrics)
   - PP = member_metric / qty × rate

3. **Rate Block:** `metric ÷ rate → hours`
   - Used for labor centers (sqft/hr, panels/hr)

### Computation phases (in order):
1. Dimensions (sq_ft, bd_ft from width/length/shape/thickness)
2. Unit cost blocks
3. Group cost pool distribution
4. Labor blocks (unit + rate)
5. Group labor pool distribution
6. Product pricing assembly (margins → hours price → final price → sale price)
7. Option and quote totals

### Key formulas:
- **Board feet:** `(width × length × raw_thickness / 144) × 1.3` (30% waste factor)
- **Square feet:** `(width / 12) × (length / 12)` or `π × (diameter/24)²` for DIA
- **Material price:** sum of (cost_pp × (1 + margin_rate)) per category
- **Hours price:** total_hours_pp × hourly_rate
- **Final price:** (material_price + hours_price) × final_adjustment_rate
- **Sale price:** final_price × (1 + rep_rate) if has_rep

### Margin rates by category (defaults, adjustable per product):
| Category | Default | Rationale |
|----------|---------|-----------|
| Hardwood | 5% | Profit via labor, not material markup |
| Stone | 25% | Little labor, profit from markup |
| Stock Base | 25% | Pure resale |
| Stock Base Shipping | 5% | Pass-through with buffer |
| Powder Coat | 10% | Outsourced process |
| Custom Base | 5% | Built in-house, profit via labor |
| Unit Costs | 5% | Components, adjustable per item |
| Group Costs | 5% | Distributed costs |
| Misc | 0% | Pass-through |
| Consumables | 0% | Pass-through |

---

## File Map

```
├── app/
│   ├── __init__.py
│   ├── main.py              ← FastAPI app, CORS, router registration
│   ├── database.py           ← async SQLAlchemy + asyncpg connection
│   ├── models.py             ← ORM models (Phase 2 block architecture)
│   ├── schemas.py            ← Pydantic request/response validation
│   ├── routers/
│   │   ├── quotes.py         ← CRUD + list + force recalculate
│   │   ├── products.py       ← CRUD under options, auto-recalc, inherits defaults
│   │   ├── quote_blocks.py   ← Block CRUD + member management (Phase 2)
│   │   ├── defaults.py       ← System defaults GET/PATCH (Phase 2)
│   │   ├── catalog.py        ← Stock base catalog + material context
│   │   ├── debug.py          ← Detailed calculation trace per product
│   │   ├── summary.py        ← Aggregated cost/labor summary for side panel
│   │   ├── species.py        ← Species assignment pricing
│   │   ├── stone.py          ← Stone assignment pricing
│   │   └── components.py     ← Product component (Material Builder) CRUD
│   └── services/
│       └── quote_service.py  ← Load → convert → compute → save orchestrator
├── calc_engine.py             ← Pure calculation functions (27 tests passing)
├── test_calc_engine.py        ← pytest test suite
├── schema_v1.sql              ← PostgreSQL DDL (16 tables + seeds + triggers)
├── requirements.txt           ← Python dependencies
├── Dockerfile                 ← Cloud Run container
├── .env.example               ← Environment variable template
│
│   ── Reference Docs (from the original Google Sheets system) ──
├── Quote_Sheet_Formula_Map.md ← CRITICAL: Every formula in the 1,682-row Pricing sheet
├── Domain_Knowledge.md        ← Business logic, margin philosophy, material paths
└── Field_Reference.md         ← Every input field: types, valid values, downstream effects
```

### ⚠️ Reference Docs — READ BEFORE MODIFYING CALC ENGINE

The three reference docs above are the **source of truth** for how calculations should work. They document the original Google Sheets formulas that the `calc_engine.py` was built to replicate. If you need to add or modify any calculation:

1. **Check `Quote_Sheet_Formula_Map.md` first** — it has the exact formula for every cell
2. **Check `Domain_Knowledge.md`** — it explains *why* formulas work the way they do
3. **Check `Field_Reference.md`** — it documents valid values and downstream effects

Key sections in the Formula Map:
- **Architecture Overview** — column structure, aggregation hierarchy, cell type distribution
- **Three Block Patterns** — Unit, Group, Rate block formulas with exact cell references
- **Section 2: Material Costs** — species/lumber, stone, stock base, UC, GC, misc formulas
- **Section 3: Hours/Labor** — panel data, 12 labor centers (two structural tiers), tag summaries
- **Section 4: Final Pricing** — margin assembly, price assembly (rows 1265-1283), dual-track analysis
- **Section 5: Reference Section** — description engine, dimension engine, dynamic dropdowns

Key sections in Domain Knowledge:
- **§1 Pricing Philosophy** — per-table architecture, why costs are hidden in table price
- **§2 Three Block Patterns** — detailed explanation with examples
- **§3 Material Types** — hardwood path, stone path, terrazzo, live edge
- **§5 Labor Centers** — LC100-LC111, two structural tiers, tag system
- **§7 Margin Structure** — core principle: margin inversely related to labor performed
- **§11 Stock Base Catalog** — catalog structure, lookup key format

---

## API Endpoints

All endpoints are prefixed with `/api`.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/quotes` | Create quote (auto-creates default option) |
| GET | `/quotes` | List quotes (filterable by status) |
| GET | `/quotes/{id}` | Full quote with all nested data |
| PATCH | `/quotes/{id}` | Update quote fields |
| DELETE | `/quotes/{id}` | Delete quote (cascades) |
| POST | `/quotes/{id}/recalculate` | Force full recalculation |
| POST | `/options/{id}/products` | Add product to option (inherits defaults) |
| PATCH | `/options/{id}/products/{id}` | Update product specs |
| DELETE | `/options/{id}/products/{id}` | Remove product |
| POST | `/quotes/{id}/blocks` | Create quote block (with optional member IDs) |
| PATCH | `/blocks/{id}` | Update block definition |
| DELETE | `/blocks/{id}` | Delete block + all members |
| POST | `/blocks/{id}/members/{product_id}` | Add product to block |
| PATCH | `/blocks/{id}/members/{product_id}` | Update member overrides |
| DELETE | `/blocks/{id}/members/{product_id}` | Remove product from block |
| GET | `/defaults` | Get system defaults |
| PATCH | `/defaults` | Update system defaults |
| GET | `/catalog` | Search stock base catalog |
| GET | `/catalog/{id}` | Get catalog item |
| GET | `/material-context` | All material types + UI config |
| GET | `/material-context/{type}` | Single material type config |

---

## Database Connection

### Local development
```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/simply_tables
```

### Cloud SQL (via Unix socket from Cloud Run)
```
DATABASE_URL=postgresql+asyncpg://postgres:PASSWORD@/simply_tables?host=/cloudsql/onyx-antler-483815-i1:us-central1:INSTANCE_NAME
```

The Cloud SQL connector library is included in requirements.txt but the current `database.py` uses a standard connection string. For Cloud Run, you may need to switch to the connector pattern or use the Cloud SQL Auth Proxy.

---

## Setup Steps (for deployment)

### 1. Create Cloud SQL Instance
```bash
gcloud sql instances create simply-tables-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --project=onyx-antler-483815-i1
```

### 2. Create Database
```bash
gcloud sql databases create simply_tables \
  --instance=simply-tables-db \
  --project=onyx-antler-483815-i1
```

### 3. Set Postgres Password
```bash
gcloud sql users set-password postgres \
  --instance=simply-tables-db \
  --password=YOUR_SECURE_PASSWORD \
  --project=onyx-antler-483815-i1
```

### 4. Run Schema
Connect via Cloud SQL proxy or gcloud and run `schema_v1.sql`.

### 5. Deploy to Cloud Run
```bash
gcloud run deploy quote-api \
  --source . \
  --region us-central1 \
  --project onyx-antler-483815-i1 \
  --allow-unauthenticated \
  --add-cloudsql-instances=onyx-antler-483815-i1:us-central1:simply-tables-db \
  --set-env-vars="DATABASE_URL=postgresql+asyncpg://postgres:PASSWORD@/simply_tables?host=/cloudsql/onyx-antler-483815-i1:us-central1:simply-tables-db"
```

### 6. Test
```bash
curl https://YOUR_CLOUD_RUN_URL/health
curl https://YOUR_CLOUD_RUN_URL/api/material-context
```

---

## Business Context

Simply Tables makes custom tables — hardwood, stone, terrazzo, live edge, laminate, outdoor. The quoting system handles complex pricing where a single job might have 18 different table configurations across multiple material types, each with different cost structures, labor hours across 12 labor centers, and per-category margins.

The existing Google Sheets system works but is slow, hard to query historically, and forces scrolling through empty fixed slots. This web app is the replacement — same calculation logic, better UX, queryable database for the learning loop (comparing quoted hours/costs to actuals from Harvest and QuickBooks).

The Google Sheets version will continue running in parallel until this system is validated.

### Key team members:
- **Colin** — owner, primary user day one
- **Sam** — new hire, will test soon (project analyst role)
- **Tony** — project manager (QuickBooks, Airtable, vendor management)
- **Caleb** — shop foreman

### Connected systems:
- **Airtable** (base: `appmysRQyjuV5dWuS`) — central operations hub
- **Google Drive** — file storage
- **Harvest** — time tracking (nightly sync to Airtable)
- **QuickBooks** — invoicing (synced to Airtable via Zapier)
