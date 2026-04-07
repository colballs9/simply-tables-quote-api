# Simply Tables Quote App — Full Build Spec

**Created:** April 6, 2026
**Context:** This spec was produced after analyzing a real quote (Farmhouse Kitchen 0737) against the existing app. It covers every gap identified plus architectural additions discussed with Colin.
**Implementation order:** Staged, each section is independent and testable before moving to the next.

**IMPORTANT FOR CLAUDE CODE:**
- Read CLAUDE.md, Quote_Sheet_Formula_Map.md, Domain_Knowledge.md, and Field_Reference.md before implementing anything
- Do not modify calc_engine.py math without verifying against the Formula Map
- Build each stage, test against the Farmhouse Kitchen numbers (included below), then move to the next
- When in doubt, ask — don't guess

---

## Table of Contents

1. Debug Endpoint (build first — needed to verify everything else)
2. Schema Additions (new tables + columns)
3. Species Pipeline (hardwood/live edge material costing)
4. Stone Pipeline (stone material costing)
5. Panel Data + Rate Labor Pipeline (automatic hours calculation)
6. Material Builder (product components — base/part dimensions)
7. Built-in vs Ad-hoc Block Architecture
8. Cost Block Naming + Multiplier Fix
9. Block Linking + Job Summary Side Panel
10. Quote-Level Fields (shipping, etc.)
11. UI Improvements
12. Farmhouse Kitchen 0737 — Verification Numbers

---

## 1. Debug Endpoint

**Purpose:** Let Colin trace every calculation step without reading code. Like clicking a cell in Sheets and seeing the formula.

**Endpoint:** `GET /api/products/{product_id}/debug`

**Response structure:**
```json
{
  "product_id": "uuid",
  "title": "Table 1",
  "quantity": 4,

  "dimensions": {
    "width": 30,
    "length": 46,
    "shape": "Custom Shape",
    "shape_custom": "Booth Table",
    "lumber_thickness": "1.75\"",
    "raw_thickness": 2.0,
    "raw_thickness_source": "THICKNESS_LOOKUP['1.75\"'] = 2.0",
    "quarter_code": "8/4",
    "bd_ft": 24.917,
    "bd_ft_formula": "(30 × 46 × 2.0 / 144) × 1.3 = 24.917",
    "sq_ft": 9.583,
    "sq_ft_formula": "(30/12) × (46/12) = 9.583"
  },

  "cost_blocks": [
    {
      "description": "Walnut 8/4",
      "category": "species",
      "is_builtin": true,
      "inputs": {"cost_per_bdft": 9.50, "bd_ft": 24.917},
      "formula": "9.50 × 24.917 = 236.71",
      "cost_pp": 236.71,
      "margin_rate": 0.10,
      "margin_pp": 23.67,
      "cost_with_margin": 260.38
    }
  ],

  "group_pool_shares": [
    {
      "pool_description": "Misc",
      "pool_total": 500.00,
      "distribution_type": "sqft",
      "this_product_metric": 38.333,
      "this_product_metric_formula": "9.583 sqft × 4 qty = 38.333",
      "total_metric_all_members": 246.833,
      "rate": 2.026,
      "rate_formula": "500.00 / 246.833 = 2.026",
      "cost_pp": 19.41,
      "cost_pp_formula": "(38.333 / 4) × 2.026 = 19.41"
    }
  ],

  "labor_blocks": [
    {
      "labor_center": "LC101",
      "description": "Processing",
      "block_type": "rate",
      "is_builtin": true,
      "inputs": {"panel_sqft": 9.583, "rate_sqft_per_hr": 15.0},
      "total_panel_sqft_all_products": 246.833,
      "total_hours_job": 17.14,
      "formula": "(38.333 / 246.833) × 17.14 / 4 = 0.639",
      "hours_pp": 0.639
    }
  ],

  "pricing_assembly": {
    "total_material_cost_pp": 343.53,
    "margin_detail": {
      "hardwood": {"cost": 236.71, "rate": 0.10, "margin": 23.67},
      "stock_base": {"cost": 75.00, "rate": 0.00, "margin": 0.00},
      "stock_base_shipping": {"cost": 0.76, "rate": 0.05, "margin": 0.04},
      "misc": {"cost": 19.41, "rate": 0.00, "margin": 0.00},
      "consumables": {"cost": 11.65, "rate": 0.00, "margin": 0.00}
    },
    "total_margin_pp": 42.46,
    "material_price_pp": 385.98,
    "total_hours_pp": 2.161,
    "hourly_rate": 150.00,
    "hours_price_pp": 324.11,
    "price_pp": 710.09,
    "final_adjustment_rate": 1.0,
    "final_price_pp": 710.09,
    "rep_rate": 0.04,
    "sale_price_pp": 738.50,
    "sale_price_total": 2954.00
  }
}
```

**Implementation:** Add a new router `app/routers/debug.py`. It calls the existing `quote_service.load_full_quote()`, runs the calc engine, but instead of saving results, formats them with formula strings showing how each number was derived. Register at `/api` prefix like other routers.

---

## 2. Schema Additions

### New Tables

```sql
-- Product components (material builder: plank, leg, apron, metal parts)
CREATE TABLE product_components (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    sort_order      INTEGER NOT NULL DEFAULT 0,
    component_type  TEXT NOT NULL,        -- 'plank', 'leg', 'apron_l', 'apron_w', 'metal_part', 'other'
    description     TEXT,

    -- Dimensions
    width           NUMERIC(8,2),         -- inches
    length          NUMERIC(8,2),         -- inches
    thickness       NUMERIC(8,4),         -- inches (raw lumber dimension)
    qty_per_base    INTEGER DEFAULT 1,    -- pieces per base
    material        TEXT,                  -- species name or material type

    -- Computed by engine
    bd_ft_per_piece NUMERIC(10,4),        -- (W × L × T / 144) × waste
    bd_ft_pp        NUMERIC(10,4),        -- per_piece × qty_per_base × bases_per_top
    sq_ft_per_piece NUMERIC(10,4),
    sq_ft_pp        NUMERIC(10,4),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_components_product ON product_components(product_id);


-- Species assignments: which species are used in this quote, at what price
-- One row per unique species+thickness combination across the whole quote
CREATE TABLE species_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,

    species_name    TEXT NOT NULL,         -- 'Walnut', 'Ash', etc.
    quarter_code    TEXT NOT NULL,         -- '8/4', '6/4', etc.
    species_key     TEXT NOT NULL,         -- 'Walnut 8/4' (species + quarter code)
    price_per_bdft  NUMERIC(10,4),        -- user enters this

    -- Computed: total bdft across all products using this species
    total_bdft      NUMERIC(12,4),
    total_cost      NUMERIC(12,2),

    UNIQUE(quote_id, species_key),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_species_quote ON species_assignments(quote_id);
```

### Columns to Add to Existing Tables

```sql
-- cost_blocks: distinguish built-in from ad-hoc
ALTER TABLE cost_blocks ADD COLUMN is_builtin BOOLEAN NOT NULL DEFAULT false;

-- labor_blocks: distinguish built-in from ad-hoc
ALTER TABLE labor_blocks ADD COLUMN is_builtin BOOLEAN NOT NULL DEFAULT false;

-- quotes: job-level fields
ALTER TABLE quotes ADD COLUMN shipping NUMERIC(12,2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN sales_tax NUMERIC(12,2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN budget_buffer_rate NUMERIC(5,4) DEFAULT 0.05;
ALTER TABLE quotes ADD COLUMN grand_total NUMERIC(12,2);  -- computed: total_price + shipping + tax

-- products: store panel data for rate labor pipeline
ALTER TABLE products ADD COLUMN panel_sqft NUMERIC(10,4);  -- total panel sqft (top + components)
ALTER TABLE products ADD COLUMN panel_count INTEGER;        -- total panels (for cutting LC)
```

---

## 3. Species Pipeline

**What it replaces:** Rows 336–520 in the Pricing sheet (species distribution, species cost blocks).

**How it works:**

1. When a product has `material_type = 'Hardwood'` or `'Live Edge'`, the engine reads its `lumber_thickness` and resolves the species key:
   - `lumber_thickness` → `raw_thickness` (via lookup: `1.75"` → `2.0`)
   - `lumber_thickness` → `quarter_code` (via lookup: `1.75"` → `8/4`)
   - `material_detail` (e.g., "Walnut") + `quarter_code` → `species_key` = `"Walnut 8/4"`

2. The engine calculates bdft for each product:
   - **Top bdft:** `(width × length × raw_thickness / 144) × 1.3` (30% waste)
   - **Component bdft:** Sum from product_components (each with their own waste factor — currently 1.25× for base components, known discrepancy, should be 1.3×)
   - **Total bdft per product** = top + components

3. The engine groups products by species_key across the entire quote:
   - "Walnut 8/4" → [Table 1: 24.92 bdft, Table 2: 65.00 bdft, ...]
   - Total bdft for "Walnut 8/4" = 660.52

4. The user enters `price_per_bdft` on the `species_assignments` record (e.g., $9.50)

5. The engine creates/updates a **built-in cost block** on each product:
   - `cost_category: 'species'`
   - `is_builtin: true`
   - `cost_per_unit: 9.50` (the $/bdft)
   - `multiplier_type: 'per_bdft'`
   - `cost_pp: 9.50 × 24.917 = $236.71`

**Key formula references (from Quote_Sheet_Formula_Map.md):**
- Row 53: `raw_thickness = XLOOKUP(lumber_thickness, thickness_table)`
- Row 54: `bdft = (W × L × raw / 144) × 1.3`
- Row 447: `species_cost_pp = bdft_pp × price_per_bdft`
- Row 448: `species_bdft_total = SUM across products`

**Engine changes:**
- Add `compute_species_pipeline()` function
- Runs BEFORE `compute_cost_block()` in the orchestrator
- Creates/updates species_assignments from product data
- Creates/updates built-in species cost blocks on each product

**API changes:**
- `GET /api/quotes/{id}/species` — list species assignments with totals
- `PATCH /api/quotes/{id}/species/{species_key}` — update price_per_bdft
- Species blocks auto-recalculate when any product's dimensions or material changes

**UI:**
- When any product is Hardwood/Live Edge, a "Species Pricing" panel appears at the quote level (maybe in the side panel or between the settings bar and products)
- Shows: "Walnut 8/4 — 660.52 bdft total — $___/bdft" with an input field
- User fills in $9.50, all products recalculate automatically

---

## 4. Stone Pipeline

**What it replaces:** Rows 521–544 in the Pricing sheet (stone cost blocks).

**How it works:**

1. When a product has `material_type` starting with `'Stone'`, the engine reads its sqft
2. Products are grouped by stone type (Stone 1, Stone 2, Stone 3 — or better, by the specific stone material like "Quartz", "Terrazzo")
3. User enters **total cost** for each stone type at the quote level
4. Engine distributes cost back to each product by their sqft proportion

**This is fundamentally a group pool** but with built-in logic:
- `total_cost` is the input (not per-sqft price)
- Distribution is always by sqft
- `cost_per_sqft` is derived: `total_cost / total_sqft`
- The built-in cost block on each product shows: `this_product_sqft × cost_per_sqft = cost_pp`

**Engine changes:**
- Add `compute_stone_pipeline()` function
- Creates built-in group cost pool for each stone type
- Auto-populates members (products with that stone type)

**UI:**
- When any product is Stone, a "Stone Pricing" panel appears at the quote level
- Shows: "Quartz — 45.00 sqft total — Total cost: $___"
- User enters total cost, distribution happens automatically

---

## 5. Panel Data + Rate Labor Pipeline

**What it replaces:** Rows 735–762 (panel data) and the rate sub-blocks in LC101, LC102, LC103, LC104, LC106, LC109.

**How it works:**

1. The engine calculates **panel data** for each product:
   - **Top panel:** If material is Hardwood/Live Edge/Laminate, the top is a panel. `panel_sqft = product.sq_ft` (using DIA sqft if applicable). `panel_count = quantity`.
   - **HB plank panels:** From product_components of type 'plank'. `sqft = component.sq_ft_pp`, `count = component.qty_per_base × bases_per_top × quantity`.
   - **HB leg panels:** Same from 'leg' components.
   - **Total panel sqft per product** = top sqft + plank sqft + leg sqft
   - **Total panel sqft across job** = SUM of (panel_sqft × quantity) for all products

2. Rate-based labor centers auto-calculate:

   | LC | What it processes | Rate field | Formula |
   |----|-------------------|-----------|---------|
   | LC101 Processing | All panels | sqft/hr | total_sqft / rate → total_hours, distributed by each product's sqft share |
   | LC102 Belt Sanding | All panels | sqft/hr | Same pattern |
   | LC103 Cutting | Top panels only | panels/hr | total_panels / rate → total_hours, distributed by panel count |
   | LC104 CNC | Gated per product | panels/hr | Only products with LC104 checkbox on |
   | LC106 Finish Sanding | All panels | sqft/hr | Same as LC101 |
   | LC109 Finishing (Spray) | All panels | sqft/hr | Same as LC101 |

3. For each rate-based LC, the engine:
   - Sums the metric (panel sqft or panel count) across all participating products
   - The user enters the **rate** (e.g., 15 sqft/hr for processing)
   - `total_hours = total_metric / rate`
   - `hours_pp = (this_product_metric_pt / total_metric) × total_hours / this_product_qty`

**Key formula references:**
- Row 749: `top_panel_sqft = IF(check, top_sqft, "")` 
- Row 768: `LC101_hours_pp = product_panel_sqft × time_per_sqft` where `time_per_sqft = total_hours / total_panel_sqft`
- Row 778: `LC102_hours_pp` — same pattern

**Engine changes:**
- Add `compute_panel_data()` — runs after dimensions, before labor blocks
- Add `compute_rate_labor()` — creates/updates built-in rate labor blocks
- Both run as part of the quote computation orchestrator

**API changes:**
- Rate values (sqft/hr, panels/hr) are stored as quote-level settings or on the built-in labor blocks
- The rates default from material_context but can be overridden per quote

**UI:**
- Rate-based labor blocks appear automatically when material type is selected
- They show the rate, the total metric, and the computed hours — but the user can override the rate
- Built-in labor blocks are visually distinct (can't delete, can override rate)

---

## 6. Material Builder (Product Components)

**What it replaces:** Rows 131–201 (Hardwood Base Material Builder) and rows 204–330 (Metal Base Worksheet).

**How it works:**

Each product can have multiple **components** — physical parts that have their own dimensions and material:

| Component Type | Fields | Produces |
|---------------|--------|----------|
| plank | width, length, thickness, qty_per_base, material (species) | bdft, sqft (feeds species pipeline + panel data) |
| leg | width, length, thickness, qty_per_base, material | bdft, sqft |
| apron_l | width, length, thickness, qty_per_base, material | bdft, sqft |
| apron_w | width, length, thickness, qty_per_base, material | bdft, sqft |
| metal_part | width, length, qty (for sqft/laser cutting area) | sqft (feeds metal fab hours) |
| other | description, cost (manual) | direct cost |

**Component calculations:**
- `bd_ft_per_piece = (width × length × thickness / 144) × waste_factor`
- `bd_ft_pp = bd_ft_per_piece × qty_per_base × bases_per_top`
- `sq_ft_per_piece = (width × length) / 144`
- `sq_ft_pp = sq_ft_per_piece × qty_per_base × bases_per_top`

**Component bdft feeds into the species pipeline:** If a plank component uses "Walnut" at thickness 1.5 (raw), it generates a species key "Walnut 6/4" and its bdft gets included in that species group's total. This is how base lumber costs are calculated separately from top lumber.

**Component sqft feeds into the panel data pipeline:** Plank and leg components add panels to the panel count, which affects LC101, LC102, LC103, LC106 hours.

**API:**
- `POST /api/products/{id}/components` — add component
- `PATCH /api/products/{id}/components/{id}` — update
- `DELETE /api/products/{id}/components/{id}` — remove
- All trigger quote recalculation

**UI:**
- "Material Builder" section between Descriptions and Cost Blocks on each product card
- "Add Component" button with type selector
- Each component shows dimensions + computed bdft/sqft
- Only appears for products with Custom Base or when manually added

---

## 7. Built-in vs Ad-hoc Block Architecture

### Built-in Blocks
- `is_builtin = true`
- Auto-created when material type is selected
- Cannot be deleted by user (but can be hidden/deactivated)
- Values auto-computed from upstream pipelines
- User can override certain inputs (rate, price per unit) but not the computed outputs
- Visually distinct in UI (different border style, lock icon, "auto" badge)

### Ad-hoc Blocks
- `is_builtin = false`
- Created on demand via "Add Cost" / "Add Hours" buttons
- Fully user-controlled — all fields editable
- Can be deleted
- Same underlying math as built-in blocks

### Which blocks are built-in per material type:

**Hardwood / Live Edge:**
| Block | Type | Auto-computed from |
|-------|------|--------------------|
| Species cost | cost (species) | Species pipeline — bdft × $/bdft |
| LC101 Processing | labor (rate) | Panel sqft ÷ rate |
| LC102 Belt Sanding | labor (rate) | Panel sqft ÷ rate |
| LC103 Cutting | labor (rate) | Panel count ÷ rate |
| LC106 Finish Sanding | labor (rate) | Panel sqft ÷ rate |
| LC109 Finishing | labor (rate) | Panel sqft ÷ rate |

**Stone:**
| Block | Type | Auto-computed from |
|-------|------|--------------------|
| Stone cost | cost (stone) | Stone pipeline — sqft × cost_per_sqft |
| LC108 Stone Fab | labor (rate) | Sqft ÷ rate |

**All materials:**
| Block | Type | Notes |
|-------|------|-------|
| LC100 Material Handling | labor (group) | Always available, distributed |
| LC111 Packing + Loading | labor (group) | Always available, distributed |

---

## 8. Cost Block Naming + Multiplier Fix

### Current problem:
The `multiplier_type` field uses confusing names: `fixed`, `per_base`, `per_sqft`, `per_bdft`.

### Rename to:

| Old name | New name | UI label | Behavior |
|----------|----------|----------|----------|
| `fixed` | `per_unit` | "Per Unit" | cost × quantity. For flat costs, units_per_product = 1 |
| (new) | `per_piece` | "Per Piece" | cost × pieces_per_table × quantity. Shows a "pieces per table" input field |
| `per_base` | `per_base` | "Per Base" | cost × bases_per_top × quantity |
| `per_sqft` | `per_sqft` | "Per Sq Ft" | cost × sqft × quantity |
| `per_bdft` | `per_bdft` | "Per Bd Ft" | cost × bdft × quantity |

### Cost block categories — three visual groups:

**Material Costs** (green/teal accent)
- species, stone, hardwood_base

**Base Costs** (blue accent)  
- stock_base, stock_base_shipping, powder_coat, custom_base, unit_cost_base

**Other Costs** (orange accent — current)
- unit_cost, misc, consumables, other

This gives Colin the three-category split he asked for: material costs, base costs, and everything else.

---

## 9. Block Linking + Job Summary Side Panel

### Block Linking

**Problem:** "Tables 3 and 7 both have a power unit. I want to see them linked and know the total spend on power units across the job."

**Solution:** Use tags as the linking mechanism. When a cost block or labor block is tagged (e.g., "Power Unit"), the side panel shows the total across all products with that tag.

- Tags already exist in the schema
- Each cost block and labor block already has a `tag_id` field
- The linking is visual — blocks with the same tag are shown together in the side panel
- Blocks with the same tag are NOT group pools — each product's block is independent. The tag just enables aggregation for reporting.

**Difference from group pools:**
- **Tagged blocks:** Each product has its own independent cost. Tag aggregates for visibility. "Power units total: $400 across 2 tables"
- **Group pools:** One lump sum distributed across products. The total is the input, the per-product share is computed.

### Job Summary Side Panel

**Always visible on the left side of the quote builder.** Shows live-updating totals:

```
┌─────────────────────────┐
│ QUOTE SUMMARY           │
│                         │
│ Materials        $6,253 │
│   Walnut 8/4     6,253  │
│                         │
│ Base Costs       $1,855 │
│   Stock Bases    1,580  │
│   SB Shipping       25  │
│   Power Unit       200  │
│   Power Shipping    50  │
│                         │
│ Other Costs        $800 │
│   Misc              500 │
│   Consumables       300 │
│                         │
│ Total Cost       $8,908 │
│ Total Margin     $1,047 │
│ Material Price   $9,955 │
│                         │
│ Labor            63.6 h │
│   LC101 Proc.    17.1h  │
│   LC102 Sanding   6.4h  │
│   LC103 Cutting   3.9h  │
│   LC106 Fin Sand 20.9h  │
│   LC109 Finish    6.3h  │
│   ...                   │
│ Hours Price      $9,547 │
│                         │
│ Quote Total    $20,282  │
│ Shipping        $1,970  │
│ Grand Total    $22,252  │
│ Op Revenue     $10,148  │
│ Job $/hr       $159.44  │
└─────────────────────────┘
```

**Data source:** Computed by aggregating across all products and pools in the current option. The engine already computes most of this — the side panel just needs to read it.

**Tagged items** show as sub-lines under their category. If "Power Unit" tag has $200 cost on Table 6, it appears under Base Costs as a line item.

---

## 10. Quote-Level Fields

Add to the quotes table and the settings bar UI:

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `shipping` | currency | 0 | Shipping cost (outside per-product pricing) |
| `sales_tax` | currency | 0 | Sales tax amount |
| `budget_buffer_rate` | decimal | 0.05 | Budget buffer percentage for cost estimates |
| `grand_total` | computed | — | `total_price + shipping + sales_tax` |

These appear in the quote settings bar and in the side panel.

---

## 11. UI Improvements

### Product Card Sections (top to bottom):
1. **General Specs** — title, material, quantity, dimensions, shape, height, base type
2. **Descriptions** — material detail, edge profile, stain/color, sheen, notes, grain direction
3. **Material Builder** — components (plank, leg, apron, metal). Only shown when Custom Base or when user adds components
4. **Material Costs** — built-in species/stone blocks (auto) + ad-hoc material costs
5. **Base Costs** — built-in stock base + shipping + powder coat + ad-hoc base costs
6. **Other Costs** — ad-hoc unit costs, misc, consumables
7. **Labor Blocks** — built-in rate blocks (auto) + ad-hoc unit/group hours
8. **Pricing Summary** — material cost, margin, hours, price PP, sale price, line total

### Built-in block visual treatment:
- Slight background tint (very subtle)
- Small "auto" badge or lock icon
- Input fields that are auto-computed are read-only with a subtle style
- Input fields the user CAN edit (like rate or $/bdft) are normal editable fields
- Cannot be deleted (no X button), but can be deactivated (toggle off)

### Side panel:
- Fixed position on the left
- Always shows current option totals
- Grouped by: Materials, Base Costs, Other Costs, Labor
- Tagged items show as indented sub-lines
- Updates live as any input changes
- Shows job-level metrics: total hours, op revenue, job $/hr

---

## 12. Farmhouse Kitchen 0737 — Verification Numbers

Use these exact numbers to verify each pipeline as it's built.

### Product Specs

| Product | Qty | W | L | Shape | Thickness | Base Type | Bases/Top |
|---------|-----|---|---|-------|-----------|-----------|-----------|
| Table 1 | 4 | 30 | 46 | Custom Shape (Booth Table) | 1.75" | Stock Base | 1 |
| Table 2 | 1 | 60 | 60 | DIA | 1.75" | Stock Base | 1 |
| Table 3 | 4 | 36 | 36 | Standard | 1.75" | Stock Base | 1 |
| Table 4 | 2 | 30 | 48 | Standard | 1.75" | Stock Base | 2 |
| Table 5 | 20 | 27 | 30 | Standard | 1.75" | Stock Base | 1 |
| Table 6 | 1 | 36 | 60 | Standard | 1.75" | Custom Base | 1 |

### Dimensions (verify Pipeline 3 + dimensions)

| Product | BdFt PP | SqFt PP | SqFt (DIA adjusted) |
|---------|---------|---------|---------------------|
| Table 1 | 24.917 | 9.583 | 9.583 |
| Table 2 | 65.000 | 25.000 | 19.625 (DIA: π × (30/12)²) |
| Table 3 | 23.400 | 9.000 | 9.000 |
| Table 4 | 26.000 | 10.000 | 10.000 |
| Table 5 | 14.625 | 5.625 | 5.625 |
| Table 6 | 39.000 | 15.000 | 15.000 |

### Species Pipeline (verify Pipeline 1)

- All 6 products use Walnut 8/4
- Price per bdft: $9.50
- Total bdft (tops only, no HWB components): 660.52

| Product | BdFt PP | Species Cost PP |
|---------|---------|----------------|
| Table 1 | 24.917 | $236.71 |
| Table 2 | 65.000 | $617.50 |
| Table 3 | 23.400 | $222.30 |
| Table 4 | 26.000 | $247.00 |
| Table 5 | 14.625 | $138.94 |
| Table 6 | 39.000 | $410.08 |
| **Total** | **660.52** | **$6,253.03** |

### Stock Base Costs

| Product | Cost PB | Bases/Top | Cost PP |
|---------|---------|-----------|---------|
| Table 1 | $75 | 1 | $75.00 |
| Table 2 | $160 | 1 | $160.00 |
| Table 3 | $45 | 1 | $45.00 |
| Table 4 | $35 | 2 | $70.00 |
| Table 5 | $40 | 1 | $40.00 |
| Table 6 | N/A (custom) | — | — |

### SB Shipping Pool: $25, by Units, Tables 1-5 only

Total units participating: 4+1+4+4+20 = 33
Rate: $25/33 = $0.7576/unit
Every product gets $0.7576 PP (except Table 4 which gets $1.5152 due to 2 bases)

### UC Blocks (Table 6 only)

| Block | Description | Cost PU | Units PP | Cost PP |
|-------|-------------|---------|----------|---------|
| UC1 | Power Unit | $200 | 1 | $200 |
| UC2 | Power Unit Shipping | $50 | 1 | $50 |

### Misc Pool: $500, by SqFt, All 6 products

Total sqft-units: (9.583×4) + (19.625×1) + (9×4) + (10×2) + (5.625×20) + (15×1) = 38.33 + 19.625 + 36 + 20 + 112.5 + 15 = 241.46

**Wait — the sheet says 246.833 total sqft.** This means the Misc pool uses `SqFt PP × Qty` where SqFt PP is the FULL sqft (25 for Table 2), NOT the DIA-adjusted sqft (19.625). Let me verify:
(9.583×4) + (25×1) + (9×4) + (10×2) + (5.625×20) + (15×1) = 38.33 + 25 + 36 + 20 + 112.5 + 15 = **246.83** ✓

**IMPORTANT:** Group pool sqft distribution uses `SqFt PP` (row 55, the W×L sqft), NOT the DIA-adjusted sqft (row 56). This matters for DIA products.

### Consumables Pool: $300, by SqFt, All 6 products

Same distribution as Misc but with $300 total. Same sqft metric (246.83).

### Margin Rates (all products)

| Category | Rate |
|----------|------|
| Hardwood | 10% |
| Stock Base | 0% |
| SB Shipping | 5% |
| Custom Base | 10% |
| Unit Cost | 10% |
| Misc | 0% |
| Consumables | 0% |

### Labor Hours PP

| Product | LC101 | LC102 | LC103 | LC106 | LC109 | LC100 | LC111 | Other | Total |
|---------|-------|-------|-------|-------|-------|-------|-------|-------|-------|
| Table 1 | 0.639 | 0.240 | 0.125 | 0.799 | 0.240 | 0.040 | 0.079 | — | 2.161 |
| Table 2 | 1.667 | 0.625 | 0.125 | 2.083 | 0.625 | 0.062 | 0.163 | — | 5.528* |
| Table 3 | 0.600 | 0.225 | 0.125 | 0.750 | 0.225 | 0.037 | 0.075 | — | 2.037 |
| Table 4 | 0.667 | 0.250 | 0.125 | 0.833 | 0.250 | 0.042 | 0.083 | — | 2.249 |
| Table 5 | 0.375 | 0.141 | 0.125 | 0.469 | 0.141 | 0.023 | 0.047 | — | 1.320 |
| Table 6 | 1.685 | 0.632 | 0.125 | 2.041 | 0.632 | 0.562 | 0.824 | LC104:0.433, LC105:3.5 | 10.434 |

*Table 2 uses DIA sqft (19.625) for rate labor calculations at the LC level, but full sqft (25) for group pool distributions. Verify this distinction.

### Final Pricing Per Product

| Product | Cost PP | Margin PP | Mat Price PP | Hours PP | Hrs Price PP | Price PP | Sale PP (×1.04) | Total |
|---------|---------|-----------|-------------|----------|-------------|----------|-----------------|-------|
| Table 1 | $343.53 | $42.46 | $385.98 | 2.161h | $324.11 | $710.09 | $738.50 | $2,954.00 |
| Table 2 | $859.28 | $101.79 | $961.07 | 5.528h | $829.25 | $1,790.32 | $1,861.93 | $1,861.93 |
| Table 3 | $297.23 | $33.52 | $330.74 | 2.037h | $305.52 | $636.27 | $661.72 | $2,646.88 |
| Table 4 | $350.93 | $42.28 | $393.20 | 2.249h | $337.39 | $730.59 | $759.81 | $1,519.62 |
| Table 5 | $197.93 | $23.93 | $221.86 | 1.320h | $197.98 | $419.84 | $436.63 | $8,732.60 |
| Table 6 | $825.37 | $117.67 | $903.04 | 10.434h | $1,565.14 | $2,468.18 | $2,566.91 | $2,566.91 |

**Quote Total: $20,281.94**
**Shipping: $1,970.00**
**Grand Total: $22,251.94**
**Total Hours: 63.65**
**Op Revenue: $10,148.43**
**Job $/hr: $159.44**

---

## Implementation Order

1. **Debug endpoint** — needed to verify everything else
2. **Schema additions** — run migrations for new tables and columns
3. **Species pipeline** — verify against Farmhouse Kitchen species numbers
4. **Cost block multiplier rename** — fix naming, add per_piece
5. **Panel data + rate labor** — verify against Farmhouse Kitchen hours
6. **Stone pipeline** — separate test quote needed
7. **Material builder** — separate test quote with custom base needed
8. **Built-in block auto-creation** — tie pipelines to material_context
9. **Block linking + tags** — visual grouping in UI
10. **Side panel** — live job summary
11. **Quote-level shipping/tax** — simple fields
12. **Three-category cost grouping** — UI reorganization
13. **Full verification** — enter complete Farmhouse Kitchen quote, match all numbers
