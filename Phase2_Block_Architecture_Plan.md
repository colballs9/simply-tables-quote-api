# Phase 2 Build Plan — Quote Block Architecture Refactor

## Goal
Replace the per-product `cost_blocks` / `labor_blocks` tables with a quote-level
`quote_blocks` table and a `quote_block_members` junction. Add a `system_defaults`
table so new quotes inherit standard rates and margins. Rebuild the UI as a
spreadsheet-style canvas where each block is a row and each product is a column.

---

## Phase 2A — Database & Models

### Migration 006
- `CREATE TABLE system_defaults` — app-level rate/margin defaults (seeded)
- `ALTER TABLE quotes` — add `default_hourly_rate` + all 10 default margin rates
- `CREATE TABLE quote_blocks` — block definition at quote level:
  - `id`, `quote_id` FK, `tag_id` FK (nullable)
  - `sort_order`, `is_builtin`, `is_active`
  - `block_domain` — `cost` | `labor`
  - `block_type` — `rate` | `unit` | `group`
  - `label` — display name / description
  - Cost fields: `cost_category`, `cost_per_unit`, `units_per_product`, `multiplier_type`
  - Labor fields: `labor_center`, `rate_value`, `metric_source`, `rate_type`, `hours_per_unit`
  - Group fields: `total_amount`, `total_hours`, `distribution_type`, `on_qty_change`
- `CREATE TABLE quote_block_members` — junction with per-member overrides + computed:
  - `id`, `quote_block_id` FK, `product_id` FK
  - Overrides: `description`, `hours_per_unit`, `cost_per_unit`, `is_active`
  - Computed: `cost_pp`, `cost_pt`, `hours_pp`, `hours_pt`, `metric_value`
- `DROP TABLE cost_blocks` (no live data)
- `DROP TABLE labor_blocks` (no live data)
- `DROP TABLE group_cost_pools`, `group_cost_pool_members`
- `DROP TABLE group_labor_pools`, `group_labor_pool_members`

### models.py
- Add `SystemDefaults` model
- Add default rate/margin columns to `Quote`
- Add `QuoteBlock` model
- Add `QuoteBlockMember` model
- Remove `CostBlock`, `LaborBlock`, `GroupCostPool`, `GroupCostPoolMember`,
  `GroupLaborPool`, `GroupLaborPoolMember` models
- Update `Product` relationships (remove cost_blocks/labor_blocks, keep components)
- Update `Quote` relationships (remove group pools, add quote_blocks)

---

## Phase 2B — Calc Engine

### calc_engine.py
The engine receives a new input format. Key changes:
- `quote_blocks` replaces `cost_blocks`, `labor_blocks`, `group_cost_pools`,
  `group_labor_pools` in the engine input dict
- Each block has a `members` list with `product_id` + optional overrides
- Rate blocks: same formula, but rate lives on the block not the product
- Unit blocks: `hours_per_unit` / `cost_per_unit` can be overridden per member
- Group blocks: distribution across members (replaces group pools)
- Engine output: computed values written back to `quote_block_members`
- Keep all existing computation formulas — only the data shape changes

---

## Phase 2C — Quote Service

### quote_service.py
- `load_full_quote` — load `quote_blocks` + members instead of old block tables
- `quote_to_engine_format` — convert new structure to engine dict
- `save_computed_results` — write back to `QuoteBlockMember` instead of old block maps
- `manage_species_pipeline` — update to create `QuoteBlock` + members instead of `CostBlock`
- `manage_stone_pipeline` — same update
- `manage_rate_labor_pipeline` — update to create `QuoteBlock` + members instead of `LaborBlock`
- `recalculate_quote` — same orchestration, updated model references
- When a product is created: inherit `hourly_rate` + margin rates from quote defaults

---

## Phase 2D — Routers & Schemas

### New router: `quote_blocks.py`
- `POST /quotes/{id}/blocks` — create a block (with optional member product IDs)
- `PATCH /blocks/{id}` — update block definition (rate, description, etc.)
- `DELETE /blocks/{id}` — delete block + all members
- `POST /blocks/{id}/members/{product_id}` — add product to block
- `DELETE /blocks/{id}/members/{product_id}` — remove product from block
- `PATCH /blocks/{id}/members/{product_id}` — update member-level overrides

### Update router: `products.py`
- On product create: copy `hourly_rate` + margin rates from quote defaults
- On product create: add product as member to all non-builtin quote blocks

### New router: `defaults.py`
- `GET /defaults` — get system defaults
- `PATCH /defaults` — update system defaults

### schemas.py
- Add `QuoteBlockCreate`, `QuoteBlockUpdate`, `QuoteBlockRead`
- Add `QuoteBlockMemberUpdate`, `QuoteBlockMemberRead`
- Add `SystemDefaultsRead`, `SystemDefaultsUpdate`
- Update `QuoteRead` — replace old block lists with `quote_blocks`
- Remove old block schemas

### main.py
- Register new routers, remove old block routers
- Remove `group_pools` router

---

## Phase 2E — Frontend

### New canvas layout
The quote builder canvas changes from:
> Product columns, each with their own block lists

To:
> Block rows × Product columns (spreadsheet style)

```
                      | T1      | T2      | T3      |
----------------------+---------+---------+---------+
COST BLOCKS                                          
  Species — Walnut    | $180    | $210    | $195    |
  [+ Add Cost Block]                                 
                                                     
LABOR BLOCKS                                         
  LC101 Processing    | 1.2h    | 0.96h   | 1.44h   |
  LC105 Wood Fab      | 2.0h    | —       | 2.0h    |
  [+ Add Labor Block]                                
                                                     
PRICING                                              
  Total Hours         | 3.2h    | 1.9h    | 3.4h    |
  Sale Price          | $1,840  | $1,620  | $2,100  |
```

### Components to build
- `BlockRow.jsx` — a single block row with editable rate fields on the left,
  per-product computed values as cells, member checkboxes to add/remove products
- `BlockRowCost.jsx` — cost-specific fields (category, multiplier, cost/unit)
- `BlockRowLabor.jsx` — labor-specific fields (LC, rate, metric source)
- `ProductHeaderRow.jsx` — product name/specs/qty as column headers
- `PricingRow.jsx` — read-only computed summary rows (hours, cost, price)
- `QuoteCanvas.jsx` — assembles the full grid

### Side panel updates
- Remove pool management (replaced by block row membership)
- Keep: summary, shipping, option switcher
- Add: hourly rate + margin rate editors per product (accessed by clicking product header)

### API client updates (`client.js`)
- Add `quoteBlocks` object (CRUD + member management)
- Remove `costBlocks`, `laborBlocks`, `groupCostPools`, `groupLaborPools`

---

## Phase 2F — Cleanup & Deploy

### Phase 2 Deploy Runbook

#### Prerequisites
- `gcloud` authenticated to project `onyx-antler-483815-i1`
- Cloud SQL Proxy installed (`gcloud components install cloud-sql-proxy`)
- Postgres password for Cloud SQL instance `simply-tables-db`

#### 1. Start Cloud SQL Proxy
Run in a separate terminal:

```bash
cloud-sql-proxy onyx-antler-483815-i1:us-central1:simply-tables-db
```

#### 2. Run Migration 006

```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/simply_tables \
  alembic upgrade head
```

Migration 006:
- Creates `system_defaults` table and seeds the global defaults row
- Adds default hourly/margin columns to `quotes`
- Creates `quote_blocks` and `quote_block_members`
- Drops old tables:
  - `cost_blocks`
  - `labor_blocks`
  - `group_cost_pools`
  - `group_cost_pool_members`
  - `group_labor_pools`
  - `group_labor_pool_members`

#### 3. Verify Migration State

```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/simply_tables \
  alembic current
```

Expected result includes:

```text
006_quote_block_architecture (head)
```

#### 4. Deploy to Cloud Run

```bash
gcloud run deploy simply-tables-quote-api \
  --source . \
  --region us-central1 \
  --project onyx-antler-483815-i1 \
  --allow-unauthenticated
```

#### 5. Verify Deployment

```bash
base="https://simply-tables-quote-api-gxdcbpwqka-uc.a.run.app"
curl -i "$base/health"
curl -i "$base/api/quotes"
curl -i "$base/api/defaults"
```

Healthy responses should be HTTP 200 for all three endpoints.

#### 6. UI Smoke Test
- Open the app in browser
- Create a new quote
- Add 2-3 products (species + rate labor blocks should auto-create)
- Edit a block rate value and confirm pricing recalculates
- Click a product header and verify the rate/margin editor opens in side panel
- Add a manual cost block via **Add Cost Block**

#### 7. Post-Deploy Check (Recommended)
- Confirm new quotes inherit expected values from `system_defaults`
- Confirm older quotes still open and recalculate without errors
- Confirm no 500s in Cloud Run logs during smoke test flows

Replace `YOUR_PASSWORD` in commands above with the actual Cloud SQL password.

---

## Session Start Checklist (for next session)

1. Read `CLAUDE.md` and this file
2. Read current `app/models.py` (already done — snapshot above)
3. Read current `app/services/quote_service.py` (already done)
4. Start with **Phase 2A** — write migration 006 first, then update models.py
5. Don't touch quote_service or frontend until models + migration are solid

---

## Key Decisions Recorded

| Decision | Rationale |
|----------|-----------|
| Drop cost_blocks / labor_blocks entirely | No live data, cleaner architecture |
| Drop group pools | Replaced by quote_blocks with group block_type |
| quote_block_members stores overrides | description, hours_per_unit vary per product |
| Rates never overwritten by pipeline | User may customize; pipeline only creates if missing |
| System defaults → quote defaults → product | Inheritance chain, each level overridable |
| Block row UI is purely frontend grouping | No extra backend concept needed |
