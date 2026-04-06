# Domain Knowledge — Simply Tables Quote System

**Living Document — Updated as new context is gathered**
**Last Updated: March 17, 2026**

---

## HOW TO USE THIS DOCUMENT

This captures the *why* behind the quote sheet — business logic, manufacturing concepts, and pricing rationale that can't be reverse-engineered from formulas alone. Information is gathered iteratively through voice interviews with Colin and verified against the actual sheet structure.

> **Revision note:** New information may recontextualize earlier sections. When that happens, the affected section is updated in place and a changelog entry is added at the bottom.

---

## 1. PRICING PHILOSOPHY

### Per-Table Architecture
The entire pricing system resolves to a **per-table (per-unit) price**. Every cost, every hour calculation, every margin — all expressed as "per table" values. Quantity multiplication only happens at the very end (Final Pricing rows 1279/1283) or on the Quote sheet itself.

**Why:** The Quote sheet — what the client actually sees — displays each product as `Unit Price × Quantity = Line Total`. So the internal system must produce a clean per-table number that can be multiplied cleanly.

### Hiding Costs in Table Price
Clients don't want to see many separate line items for shipping, powder coating, hardware, etc. The system is designed to **roll costs into the per-table price** so the quote looks simple: "This table costs $325 each." Behind the scenes, that $325 includes material, labor, margin, distributed shipping, consumables, and more.

### Aggregation Levels *(verified from registry analysis)*
The named range suffixes encode the aggregation level consistently across the entire system:
- **PU** (Per Unit) — cost or hours for a single unit/piece/base
- **PB** (Per Base) — cost for a single base unit
- **PP** (Per Product) — the fundamental per-table value. This is what the pricing system resolves to
- **PT** (Product Total) — PP × Quantity. Intermediate aggregation for job-level sums
- **Total** (Job-level) — SUM across all products (columns E:V). Lives in column C, not in product columns

This hierarchy is consistent everywhere: material costs, labor hours, pricing. Understanding it is key to reading any named range.

---

## 2. THE THREE BLOCK PATTERNS *(verified)*

Despite the sheet having hundreds of named ranges across dozens of sections, nearly every calculation block in the system is a variation of just **three fundamental patterns**. Understanding these three patterns is the single most important thing for understanding the quote sheet. Everything else is just a specific label, a different multiplier, or a checkbox gate bolted on.

### Pattern 1: Unit Block
**Core idea:** "I know the cost/hours for one thing — multiply it out."

```
Value per unit × multiplier → PP → PT (×Qty)
```

The simplest and most common pattern. A known per-unit value gets scaled up to per-product, then to product total. The multiplier varies by context — it might be units per product, bases per top, or just 1 (pass-through).

**Where it appears in Material Costs:**
- **UC1–UC9** (Unit Cost Project): CostPU × UnitsPP → CostPP
- **UCB1–UCB4** (Unit Cost Base): CostPB × BasesPerTop → CostPP
- **Powder Coat 1 & 2:** CostPB × BasesPerTop → CostPP *(same math as UCB, just a named slot)*
- **Stock Base:** CostPB × BasesPerTop → CostPP
- **Species 1–6:** BdFt × PricePerBdFt → CostPP
- **Stone 1–3:** SqFt × CostPerSqFt → CostPP
- **HWB Builder components** (Plank, Leg, ApronL, ApronW): dimensions → BdFtPerPiece × QtyPerBase → BdFtPP

**Where it appears in Hours:**
- **UH1/UH2 slots** in every Tier 2 labor center: HoursPU (input) passes straight through to HoursPP
- **LC107 Bases:** HoursPU × UnitsPP (bases per product) *(gated by checkbox)*
- **LC107 Other1/Other2:** HoursPU × UnitsPP (manual piece count) *(gated)*
- **LC105 W1:** HoursPP direct input per product *(gated)*

**Key insight:** Powder coating, stock base cost, UCB slots, and species pricing all look different in the sheet but are structurally identical — they're all unit blocks with different labels and multipliers. Even the HWB Builder components are unit blocks (dimensions × quantity → board feet per piece).

### Pattern 2: Group Block
**Core idea:** "I have a lump sum — distribute it proportionally across checked products."

```
Total value (job-level) → checkbox gate → distribute by type metric → PP
```

Always a **three-row structure:**
1. **Row 1:** Checkbox per product (gate) + Total value in column C + Description
2. **Row 2:** Type metric per product — calculated from distribution type in column A
3. **Row 3:** Result PP = (product's metric / Qty) × Rate, where Rate = Total / SUM(all metrics)

**Distribution types** (set via dropdown in column A):
- **Units** — even by quantity. Use when cost doesn't scale with table size
- **Sq Ft** — proportional by top square footage. Use when larger tables should absorb more cost
- **Bd Ft** — proportional by board footage. Less common

**Where it appears in Material Costs:**
- **GC1–GC6** (Group Cost Project)
- **GCB1–GCB4** (Group Cost Base)
- **Stock Base Shipping**
- **Misc**
- **Consumables**

**Where it appears in Hours:**
- **GH1/GH2 slots** in every Tier 2 labor center — same three-row structure, distributing hours instead of cost

**Why checkboxes are essential:** Not all products share every cost pool. Example: 5 tables have stock bases with $300 shared shipping, but a 6th table has a custom in-house base. The checkbox gates which products participate, so the 6th table isn't burdened with shipping it didn't incur.

**Why Sq Ft distribution matters:** If 4 small tables and 1 large table share $500, even distribution puts $100 on each. But the small tables end up looking disproportionately expensive to the client. Sq Ft distribution weights the large table appropriately — this is critical for keeping individual table prices looking right on the customer quote.

### Pattern 3: Rate Block
**Core idea:** "I know the total metric and a processing rate — derive hours proportionally."

```
Total metric ÷ rate = total hours → distribute to products by their share of the metric
```

Used exclusively in labor/hours calculations. A rate (sqft/hr, panels/hr) in column B defines throughput. Total hours are calculated at the job level, then each product gets hours proportional to its contribution to the total metric.

**Where it appears:**
- **LC101 Processing:** Total panel SqFt ÷ SqFt/hr rate → hours per product by SqFt share
- **LC102 Belt Sanding:** Same pattern, different rate
- **LC103 TopPanel, HBPanels, OtherPanels:** Panel count ÷ panels/hr rate → hours *(gated by checkbox)*
- **LC104 TopPanels:** Panel count ÷ rate *(gated)*
- **LC106 TopPanel, HBPanels:** SqFt ÷ rate *(gated)*
- **LC108 Polishing, Terrazzo:** SqFt-based rates *(gated)*
- **LC109 Spray, Stain:** SqFt-based rates *(gated)*

### The Checkbox Gate — Optional Modifier on Any Pattern
A checkbox can attach to any of the three patterns to control whether the block activates for a given product:
- **Unit Blocks:** LC105 W1, LC107 Bases/Other1/Other2 have checkboxes. Most UC/UCB blocks don't (they use zero-guard formulas instead — `if(value=0, "", calculate)`)
- **Group Blocks:** All have checkboxes by definition — it's part of the three-row structure
- **Rate Blocks:** LC103–LC109 sub-blocks have checkboxes. LC101/LC102 don't (they process everything in the panel data)

Some checkboxes are manual inputs, others are formula-derived (LC106 TopPanel, LC109 Spray auto-calculate from upstream data).

### Block Pattern Summary

| Pattern | Count in Registry | Core Math | Used For |
|---------|------------------|-----------|----------|
| Unit Block | 330 | value × multiplier → PP | Material costs, UH hours, HWB builder |
| Unit Block (gated) | 36 | same + checkbox | LC105 W1, LC107 piece-based hours |
| Group Block | 245 | lump sum ÷ proportional → PP | GC, GCB, shipping, misc, consumables, GH hours |
| Rate Block | 18 | metric ÷ rate → proportional hours | LC101, LC102 |
| Rate Block (gated) | 75 | same + checkbox | LC103–LC109 sub-blocks |
| *(no pattern)* | 348 | — | Specs, descriptions, pricing, tags, summaries |

---

## 3. MATERIAL TYPES & BRANCHING

### Hardwood Path
When `P_MaterialType = "Hardwood"`:
- Species, lumber thickness, and board foot calculations activate
- Species key generation (§10.1) builds a key like "Red Oak 6/4" from species name + thickness → drives species distribution and pricing
- Waste factor: **1.3× for tops** (30% waste). Base components currently use **1.25×** (25% waste) but this is a known discrepancy — both should be 1.3×, base just hasn't been updated yet *(verified)*
- Cost driven by BdFt × price per BdFt (from species pricing)
- Margin rate: typically 5% on hardwood tops (low because profit comes from labor, not material markup — see §7)
- Description engine (§10.2) adds "Solid" prefix and auto-populates "Hospitality Grade Protective Finish"

### Hardwood Cost Split: Top vs Base *(verified from formula analysis)*
Hardwood cost is tracked separately at the pricing level:
- **`P_Hardwood_TopCostPP`** — only the top lumber cost, feeds into the Hardwood margin calculation
- **`P_Hardwood_BH_CostPP` / `P_Hardwood_BH_CostPT`** — base hardwood cost, feeds into the Custom Base Cost margin calculation
- **`P_Hardwood_CostPP`** — total (top + base), used for the material cost rollup

This split matters because top hardwood gets the Hardwood margin rate (5%) while base hardwood gets grouped with Custom Base Cost margin rate (also 5% default, but independently adjustable). The `P_BaseAndHB_CostPP` range aggregates GCB + UCB + PowderCoat2 + HardwoodBaseCost for the custom base margin calculation.

### Stone Path
When `P_MaterialType = "Stone"` (or similar):
- Square footage drives cost instead of board feet
- Up to 3 stone slots for different stone types
- Margin rate: typically 25% — applies regardless of whether vendor handles substrate/painting or you do it in-house *(verified)*
- Some vendors deliver palette-ready (substrate + paint + attachment done), meaning minimal labor → profit comes from markup
- Other vendors provide stone only, and Simply Tables does substrate/painting work in-house → labor hours captured in LC108, but the 25% material markup still applies
- Description engine (§10.2) auto-populates "3/4 Plywood Substrate Painted Black" at row 87
- Dynamic dropdown (§10.3) provides stone-specific material options (Quartz, Terrazzo, Granite...) and vendor names (Daltile, MSI, Caesarstone...)
- Terrazzo is a specific stone type with its own in-house pour workflow — see §3.1 below

### 3.1 Terrazzo Workflow *(verified from Colin interview, March 2026)*

Terrazzo at Simply Tables is an **in-house cast concrete product** — not a purchased slab. Simply Tables pours, cures, and sends out for milling. This distinguishes it from all other stone types, which are purchased from vendors.

#### Mix Recipe (per 50 lb bag of concrete)

All additives are percentages of the concrete base weight:

| Ingredient | % of concrete | Lbs per bag | Notes |
|---|---|---|---|
| Concrete | — | 50 lbs | 1 bag |
| Water | 12% | 6 lbs | — |
| Fiber | 0.5% | 0.25 lbs (4 oz) | Reinforcement additive |
| Pigment (total) | 0–5% max | 0–2.5 lbs | All colors combined cannot exceed 5% |
| Rock/Aggregate | 60% | 30 lbs | Split across rock types |

Plasticiser was previously in the recipe but is no longer used.

**Pigment rules:**
- The 5% cap is a **combined total across all colors** — not per color. A mix using black + white + green cannot exceed 5% total.
- White and black can go up to the full 5% when used alone
- Reds, yellow, Chrome Oxide Green: max ~3% each
- Stir-N Blue: low percentage only (max ~1%) — very strong tint

**Rock/Aggregate:**
- Multiple rock types per pour are common — each type specified as a % of the concrete weight
- Standard recipe: Ozark (42% of concrete = 21 lbs) + Cream (18% of concrete = 9 lbs)
- Rock percentages must sum to 60% total

#### Pour & Form Sizing

- **1 bag (50 lbs concrete) = 6 sq ft of terrazzo at 1.25" raw pour depth**
- The 1.25" raw pour is always the same regardless of finished thickness — difference is in milling
- **Finished thickness options:**
  - 7/8" — standard (less milling)
  - 3/4" — thin finish (more milling, extra labor cost TBD)
- **Form sizing:** Form is always 1"–2" oversized per side beyond the finished top dimensions
  - e.g., 24×24 top → ~25×25 or 26×26 form
  - Multiple tops per form are common: two 24×24 tops → ~50×25 form
- **Material calculation uses form sq ft, not finished tabletop sq ft**
- **Milling cost uses form sq ft** (subcontracted milling is priced on form area)
- Bags are rounded up to the nearest **quarter bag** (fractional mixes are fine — the recipe scales proportionally)

#### Material Costs

**Per bag of concrete:**

| Item | Cost/bag | Notes |
|---|---|---|
| Concrete | $35.00 | — |
| Fiber | $1.00 | 0.25 lbs × $4.00/lb ($200 ÷ 50 lb bag) |
| Rock | $10.00 | Standard assumption; actual varies by rock type and vendor |
| Pigment | varies | See pigment list below |
| **Subtotal (ex-pigment)** | **$46.00** | — |

**Pigment price list (fully loaded $/lb including shipping):**

Standard quoting rate: **$5.00/lb flat** (simplifies calculation; actual rates vary by color).

Actual loaded rates for reference:

| Pigment | Bag size | $/lb loaded | Max % | Notes |
|---|---|---|---|---|
| Black Iron Oxide B 100 | 50 lb | $5.00 | 5% | High usage |
| Stir-N Black 7 | 10 lb | $15.50 | 5% | High usage |
| Titanium Dioxide White | 50 lb | $6.00 | 5% | High usage |
| Chrome Oxide Green 4099 | 50 lb | $9.25 | 3% | — |
| Red Iron Oxide R 481 | 50 lb | $5.00 | 3% | — |
| Red Iron Oxide R 489 | 50 lb | $5.00 | 3% | — |
| Yellow Iron Oxide Y-554 | 50 lb | $5.00 | 3% | — |
| Stir-N Blue 15:0 | 10 lb | $24.50 | 1% | Low % only |

Prices are fully loaded (vendor price + $100 estimated shipping per box). Cobalt Blue and Stir-N Green are not currently used.

**Per-job flat costs:**

| Item | Cost | Notes |
|---|---|---|
| Concrete shipping | $300 flat | Ordered in pallet quantities for stock; amortized as flat per job |
| Milling | $15 × form sq ft | Subcontracted; based on form sq ft |
| Milling delivery | $200–$300 flat | Per job |

#### Cost Per Finished Sq Ft Reference

Based on 24×24 top, 2 per form, 1" overage, max 5% pigment at $5/lb flat rate. Excludes flat fees (concrete shipping + milling delivery):

| Category | $/finished sq ft |
|---|---|
| Concrete | $6.58 |
| Fiber | $0.19 |
| Rock | $1.88 |
| Pigment (max 5%) | $2.35 |
| Milling | $16.93 |
| **Total (ex-flat fees)** | **~$27.93** |

> **Note:** The $/sq ft figure shifts with job size because flat fees ($500–$600) amortize differently. A 4-top job runs ~$62/finished sq ft all-in; a 12-top job runs ~$39/finished sq ft. Use the terrazzo cost calculator for accurate per-job pricing rather than a fixed preset $/sq ft.

#### Sheet Integration

- Material cost enters the sheet via `StoneN_CostInput` (column C) — total job cost for that stone slot
- The sheet divides by total sq ft to get a per-sq-ft rate, then distributes to each product column proportionally
- LC108 has a dedicated **`P_LC108_Terrazzo_Check`** checkbox — separate from the Polishing check — with its own SqFt-based rate for terrazzo-specific fabrication labor
- Finished thickness (7/8" or 3/4") goes in `P_Desc_Thickness`; set explicitly for stone (does not auto-fill like hardwood)

### Live Edge Path
When `P_MaterialType = "Live Edge"`:
- Similar to hardwood but with different lumber pricing (premium)
- *(Details TBD)*

---

## 4. BASE TYPES *(verified)*

### Classification Principle
The base type in the sheet reflects **where it comes from**, not how much work Simply Tables does to it. A stock base stays "Stock Base" even with significant in-house modifications — you just add labor hours to account for the extra work.

### Stock Base
Any base purchased from a vendor that is already built, has a set size and height, and is more or less in stock. Can come from many different companies/sources. *(verified)*

- Vendor, type, style, plate size
- Unit cost per base (e.g., $255) — **Unit Block pattern**
- Cost multiplied by Bases Per Top
- Separate shipping cost (often distributed via **Group Block pattern**)
- Separate powder coating cost (per base unit — **Unit Block pattern**)
- Simply Tables does not typically assemble stock bases — they arrive unassembled and client's installers handle assembly *(verified)*
- **Modifications are common:** e.g., customer wants coffee table height → bring base in-house, cut the column down in metal fab. This adds LC107 hours but the base type stays "Stock Base" *(verified)*
- The 25% markup is justified: primarily a resale item, with labor hours capturing any modification work separately

### Custom Base
Any base fabricated from scratch — in-house or subcontracted (e.g., to Abbarcade). *(verified)*

Covers a wide range:
- **Fully metal bases** — hours go into LC107 Metal Fab, material cost is manually estimated. The metal base worksheet (rows 204–330) tracks dimensions/sqft but does NOT auto-calculate cost — it's a sizing tool, not a costing tool *(verified)*
- **Hardwood bases** — uses the Hardwood Base Material Builder (Plank, Leg/Beam, Apron L, Apron W) for lumber BdFt calculations. Each component is a **Unit Block** (dimensions → BdFt per piece × qty). Connects to species pricing and panel hours
- **Subcontracted bases** — cost entered directly
- **Not every custom base uses the HB Material Builder** — only when there are actual wood components to calculate. Metal custom bases skip it entirely *(verified)*

### Top Only
No base — just the table top. Base description auto-fills "Table Top Only."

---

## 5. LABOR CENTERS (LC100–LC111)

### Overview
12 labor centers covering the full manufacturing process. Each calculates hours per table, which get multiplied by a shop hourly rate to produce labor cost.

| Code | Name | Primary Driver | Block Patterns Used |
|------|------|---------------|---------------------|
| LC100 | Material Handling | UH/GH only | Unit + Group |
| LC101 | Processing | SqFt rate | Rate |
| LC102 | Belt Sanding | SqFt rate | Rate |
| LC103 | Cutting (Sliding Saw) | Panels/hr rate + checkboxes | Rate (gated) + Unit + Group |
| LC104 | CNC | Panels + UH/GH | Rate (gated) + Unit + Group |
| LC105 | Wood Fab | Table count + UH/GH | Unit (gated) + Unit + Group |
| LC106 | Finish Sanding | SqFt rate | Rate (gated) + Unit + Group |
| LC107 | Metal Fab | Pieces × hours/piece | Unit (gated) + Unit + Group |
| LC108 | Stone Fab | SqFt + fixed hours | Rate (gated) + Unit + Group |
| LC109 | Finishing | SqFt rate (spray + stain) | Rate (gated) + Unit + Group |
| LC110 | Assembly | UH/GH only | Unit + Group |
| LC111 | Packing + Loading | UH/GH only | Unit + Group |

### Two Structural Tiers of Labor Centers *(verified from formula analysis)*

**Tier 1 — Pure Rate Block (LC101, LC102):**
These are the simplest. They have no UH/GH sub-blocks and no tag system. They're a single Rate Block: total panel square footage divided by a rate (sqft/hr), distributed proportionally to each product based on its sqft contribution. They also calculate a separate `BasePP` value that splits out hours attributable to base panels specifically.

**Tier 2 — Composite (LC103–LC111, LC100):**
These combine multiple block patterns within a single labor center. A typical Tier 2 LC contains some mix of: Rate Blocks (gated) for throughput-based calculations, Unit Blocks for direct hours input (UH slots), Group Blocks for distributed hours (GH slots), and tag summaries for cost allocation. LC103 is the most complex with three Rate Blocks plus a Unit Block plus a Group Block. LC100/LC110/LC111 are the simplest Tier 2 centers — Unit + Group blocks only, no rate-based sections.

### Panel Data Section — Shared Data Layer, Not a Labor Center *(verified)*

The "Panel Building" section (rows ~735–762) is **not** a labor center. It's a shared data layer that calculates panel counts and square footage used by multiple downstream labor centers. It contains:

- **Three checkbox-gated panel types:** Top Panels (`P_Hours_PanelTop_Check`), HB Plank Panels (`P_Hours_HBPlank_Check`), HB Leg Panels (`P_Hours_HBLeg_Check`)
- **Per-type calculations:** Panel count (PT), SqFt per product (PP), SqFt product total (PT)
- **Combined totals:** `P_Hours_Panels_SqftPP` sums all three types' sqft for each product
- **Job totals:** TotalPanels, AvgSqftPerPanel, total sqft

The checkboxes here gate whether those panel types *exist at all* in the job. When a checkbox is TRUE, the panel count and sqft are calculated; when FALSE, they return blank. These values are then referenced by LC101 (Processing), LC102 (Belt Sanding), LC103 (Cutting), LC104 (CNC), and LC106 (Finish Sanding).

### Tag System — Full Cost Allocation Architecture *(verified from formula analysis)*

The tag system is more structured and important than a simple label. It's a **full cost allocation system** that breaks hours into categories for analysis and downstream use.

**How it works:**
1. Every sub-block within a labor center (TopPanel, HBPanels, UH1, GH1, etc.) has a **Tag dropdown** in column A with options: "Top / General", "Base", "Feature 1", "Feature 2", "none"
2. At the bottom of each LC (Tier 2 only), **tag summary formulas** sum hours only from sub-blocks whose tag matches:
   - `LC103_TagBase_TotalHours` = sum of all LC103 sub-blocks tagged "Base"
   - `P_LC103_TagBase_HoursPP` = same, per product
   - Same for TagFeature1 and TagFeature2
3. At the **Hours Tag Summary section** (rows ~1172–1176), these roll up across ALL 12 labor centers:
   - `P_TagBase_HoursPP` = SUM of TagBase from every LC
   - `TagBase_TotalHours` = job-level total
   - Same for Feature1, Feature2
4. `P_TagGeneralTop_HoursPP` is calculated as the remainder: total hours minus Base minus Feature1 minus Feature2

**What the tags mean in practice:**
- **Top / General** — hours for the table top or general work not specific to a base or feature
- **Base** — hours attributable to base fabrication/modification
- **Feature 1 / Feature 2** — hours for special features (custom details, add-ons, etc.)
- *(Specific examples of what constitutes a "feature" in real quotes: TBD)*

This enables analysis like "how many hours of this job are base work vs top work" — useful for understanding where time goes, especially on complex multi-component jobs.

### Rate Stability
- *(Are the sqft/hr and panels/hr rates in column B stable across jobs, or adjusted per job? TBD)*

---

## 6. HOW THE THREE PATTERNS MAP TO THE FULL SHEET

This section connects the abstract patterns from §2 to the concrete sheet structure, showing how a small number of patterns generate the entire 1,300+ row system.

### Material Cost Section (Rows 336–729)
Every cost slot is either a Unit Block or a Group Block:

| Block Type | Pattern | Slots | Multiplier |
|-----------|---------|-------|------------|
| Species 1–6 | Unit | 6 | BdFt × $/BdFt |
| Stone 1–3 | Unit | 3 | SqFt × $/SqFt |
| Stock Base | Unit | 1 | CostPB × BasesPerTop |
| SB Shipping | Group | 1 | Lump sum distributed |
| Powder Coat 1–2 | Unit | 2 | CostPB × BasesPerTop |
| UCB 1–4 | Unit | 4 | CostPB × BasesPerTop |
| GCB 1–4 | Group | 4 | Lump sum distributed |
| UC 1–9 | Unit | 9 | CostPU × UnitsPP |
| GC 1–6 | Group | 6 | Lump sum distributed |
| Misc | Group | 1 | Lump sum distributed |
| Consumables | Group | 1 | Lump sum distributed |

### Hours Section (Rows 730–1177)
Each labor center is built from a combination of the three patterns:

| LC | Rate Blocks | Unit Blocks (UH) | Group Blocks (GH) | Other Unit (gated) |
|----|-------------|-------------------|--------------------|--------------------|
| LC101 | 1 (pure) | — | — | — |
| LC102 | 1 (pure) | — | — | — |
| LC103 | 3 (gated) | 1 | 1 | — |
| LC104 | 1 (gated) | 2 | 2 | — |
| LC105 | — | 2 | 2 | 1 (W1) |
| LC106 | 2 (gated) | 1 | 1 | — |
| LC107 | — | 1 | 1 | 3 (Bases, Other1, Other2) |
| LC108 | 2 (gated) | 1 | 1 | — |
| LC109 | 2 (gated) | 1 | 1 | — |
| LC110 | — | 2 | 2 | — |
| LC100 | — | 2 | 2 | — |
| LC111 | — | 2 | 2 | — |
| **Total** | **12** | **15** | **15** | **4** |

### Pricing Section (Rows 1181–1355)
The pricing section doesn't use block patterns — it's a calculation pipeline that takes the outputs of all the blocks above (total cost PP, total hours PP) and applies margins, hourly rates, and adjustments to produce the final price.

---

## 7. MARGIN STRUCTURE *(verified)*

### Core Principle: Where Does Profit Come From?

The margin rate on a material category is **inversely related to how much labor Simply Tables performs on it:**

- **High labor items (hardwood):** Profit comes from labor hours × shop rate. Material markup is low (5%) because the raw lumber is just an input to the real value-add (manufacturing).
- **Low/no labor items (stone, stock bases):** Little or no shop labor involved. Profit must come from marking up the material itself. Hence 25%.

This is the fundamental business logic behind the rate differences.

### Per-Category Margins (Template Defaults)

These are starting points in the template sheet — **not fixed rules**. Colin adjusts per job based on cost uncertainty, vendor pricing, and component specifics. *(verified)*

| Category | Default Rate | Rationale |
|----------|-------------|-----------|
| Hardwood (Top Only) | 5% | Raw material — profit via labor *(verified)* |
| Stone | 25% | Purchased finished or near-finished — profit via markup *(verified)* |
| Stock Base | 25% | Pure resale, no labor performed *(verified)* |
| Stock Base Shipping | 5% | Pass-through cost with small buffer |
| Powder Coating | 10% | Outsourced process, moderate markup |
| Custom/Other Base | 5% | Built in-house — profit via labor |
| Unit Costs | 5% | Components (outlets, grommets) — adjustable per item *(verified)* |
| Group Costs | 5% | Distributed costs — small buffer |
| Misc | 0% | Pure pass-through |
| Consumables | 0% | Pure pass-through |

### When Rates Get Adjusted *(verified)*
- **Cost uncertainty:** If buying special/unusual wood and the final cost isn't locked in, raise the margin to build in a buffer
- **Component markup:** UC slot items (outlets, hardware) can be dialed up individually if you want margin on that component
- **Per-job flexibility:** Any rate can be changed per product column — the template defaults are just the starting point

### Final Adjustment Rate *(verified)*
Row 1275, default 1.0. A **bidirectional multiplier** on the entire per-table price.

- **Down (< 1.0):** Discount lever. Used after building the full quote when the calculated price comes in too high for the market. Colin first reviews hours and costs for overestimates, then uses this as the final lever.
- **Up (> 1.0):** Premium lever. Used for large conference tables where cost-plus-labor undervalues the product. Example: a table might calculate to $5,000 but market value is $10,000.

**Key design choice:** Multiplies price, not hours. Production hours stay accurate for shop planning — the effective labor rate (Op Rev ÷ Hours in Job Summary) absorbs the adjustment instead. Verified against formula map: Row 1277 `P_FinalPrice = P_Price × P_FinalAdjustmentRate`, hours feed separately at row 1270.

### Dual-Track Pricing Analysis *(verified from formula analysis)*

The Pricing section maintains **two parallel analysis tracks** after price assembly:

1. **As-Calculated Track** (rows ~1300–1308): Hours Price Total, Shop Hourly Rate, Material Margin, Total Material Cost + Margin — computed from the raw prices before final adjustment
2. **Adjusted Track** (rows ~1311–1316): Same metrics but after multiplying by the Final Adjustment Rate

Both tracks calculate: Hours Price Total → Effective Shop Hourly Rate → Material Margin PP/PT → Total Material Margin

This lets Colin see the impact of the Final Adjustment Rate on effective rates. For example, if the adjustment is 1.2× (20% premium), the "adjusted" shop hourly rate will be higher than the base rate, confirming the premium is flowing to labor economics rather than distorting material margins.

### Rep Commission *(verified)*
- Standard rate: **8%** (C4 = 0.08), applied on top of final price when B4 = "Yes"
- **Not every job has a rep.** Jobs Simply Tables sells directly, or jobs in territories without rep coverage, are marked "No"
- Rep applies when: the job is in a rep's territory, or the rep sent the job directly, or introduced the client/design firm/purchasing agent
- Rate is standard 8% — not adjusted per job

---

## 8. NAMED RANGE NAMING CONVENTIONS *(documented from registry analysis)*

### Prefix Rules
- **`P_` prefix** — Product-level range. Points to column D (RowKey). Actual values live in columns E–V (P_1 through P_18)
- **No prefix** — Job-level range. Points to the actual cell (typically column A, B, or C)

### Structural Encoding
The name itself encodes most dimensional information:
```
P_[Block][Instance]_[Field][Aggregation]
```

Examples:
- `P_UC3_CostPP` → Unit Block, Unit Cost slot 3, Cost, Per Product
- `P_LC107_GH1_HoursPP` → Group Block, LC107 Metal Fab Group Hours slot 1, Hours, Per Product
- `Species2_PricePerBdFt` → Unit Block, Species slot 2, price per board foot (job-level input)
- `LC103_TagBase_TotalHours` → Tag Summary (not a block), LC103 Cutting Base tag, Total (job-level)

### Block Type Prefixes in Material Cost
- **UCB** = Unit Cost Base (Unit Block — per-base pricing, ×BasesPerTop to get PP)
- **GCB** = Group Cost Base (Group Block — distributed base costs)
- **UC** = Unit Cost Project (Unit Block — per-unit pricing, units×cost to get PP)
- **GC** = Group Cost Project (Group Block — distributed project costs)
- **SB** = Stock Base (Unit Block for base cost, Group Block for shipping)
- **Species** = Lumber species cost blocks (Unit Block)

### Block Type Prefixes in Hours
- **UH** = Unit Hours (Unit Block — direct hours input per table)
- **GH** = Group Hours (Group Block — distributed hours, same three-row pattern as Group Cost)
- **Tag** = Tag-based summary (aggregation layer, not a block pattern)

### The HWB/HB/BH Rename *(documented)*
The Hardwood Base Builder ranges were renamed from `P_BH_` to `P_HWB_` during the Named Range Map rebuild. Old names (`P_BH_`, `HB_`) may appear in some documentation or registry History entries. The two remaining `P_BH_` ranges (`P_Hardwood_BH_CostPP`, `P_Hardwood_BH_CostPT`) are material cost fields, not builder fields — the "BH" stands for "Base Hardwood" in that context, not "Base (Hardwood builder)."

---

## 9. COMMON CONFIGURATIONS

*(To be populated as Colin walks through real quote examples)*

### Typical Product Mix
- Placeholder data shows 8 products configured in a single job: 6 hardwood variants (Red Oak, Ash, Walnut×2, White Oak, plus Live Edge and Laminate stubs), 1 stone (Quartz), demonstrating that multi-material jobs are normal
- *(How many of 18 product columns are typically used per job? TBD — placeholder suggests 6–8 is realistic)*

### Common UC Slot Items
*(TBD — next interview topic)*

---

## 10. REFERENCE SECTION ARCHITECTURE *(verified from formula analysis + placeholder data trace)*

The reference section (rows 1371–1595) contains five interconnected subsystems that support the main pricing sheet. None of these are visible to the customer — they're backend engines that generate descriptions, validate inputs, and drive cost calculations.

> **Row number note:** This section was cleaned up in February 2025, removing ~91 rows of dead/broken content (empty unit pricing stubs, broken Inputs lookups, decimal hours reference table, quoting questionnaire). All row numbers reflect the cleaned 1,595-row file.

### 10.1 Species Key System — How Hardwood Gets Priced

The entire hardwood pricing chain depends on a single concept: the **species key** — a string like "Red Oak 6/4" that combines species name + lumber quarter code. This key is what connects user input ("I want a Red Oak table at 1.25" thickness") to the pricing engine ("Red Oak 6/4 costs $X.XX per board foot").

**The chain works in five steps:**

1. **Material gate:** If material type is Hardwood or Live Edge, pull species name from the material dropdown (row 72). Otherwise, the entire chain returns blank — stone/laminate/outdoor products skip this entirely.

2. **Species validation:** The species name is checked against a master list of 14 valid species (row 1457–1470). Invalid entries return blank, preventing downstream errors.

3. **Thickness lookup:** The user-entered thickness string (e.g., "1.25"") is resolved via XLOOKUP to two values:
   - **Raw decimal** (1.5) — the actual lumber dimension before milling. Feeds the BdFt calculation at row 54.
   - **Quarter code** ("6/4") — the lumber industry standard. Feeds the species key.

4. **Key generation:** `JOIN(species, code)` produces the key: "Red Oak 6/4"

5. **Key distribution:** The key propagates to:
   - Species distribution blocks (rows 381–435) — which products use this species
   - Species pricing blocks (rows 438–514) — cost calculation by species
   - Unique species deduplication (row 1445) — up to 8 unique species per job

**Why five parallel key chains:** Each product can have a different species for its top, and HWB base components (plank, leg, apron-L, apron-W) can each use different species too. A single product might use Walnut 6/4 for its top, Maple 4/4 for planks, and Mahogany 8/4 for legs. All five keys feed into the deduplication system, which produces up to 8 unique species+thickness combinations across the entire job.

**Why quarter codes matter:** Lumber is priced per board foot, and cost varies significantly by thickness. "Red Oak 6/4" (1.25" finished) costs less per BdFt than "Red Oak 8/4" (1.75" finished) because thicker boards are scarcer and more expensive. The species key captures both dimensions of pricing variation.

### 10.2 Description Autofill Engine — How Customer Descriptions Are Built

Six description rows (32, 34, 35, 36, 37, 38) are auto-generated from spec inputs. These feed directly into the Quote sheet that customers see.

**Design pattern:** Each description line follows the same approach:
1. Stage relevant field values into consecutive rows in the reference section
2. Use `JOIN(" - ", FILTER(range, LEN(range)))` to concatenate only non-empty values
3. Route the result based on material type or base type

**Material-dependent routing:**
- **Row 34 (Top Material + Finish):** Hardwood gets "Solid" prefix + stain/color handling logic. Non-hardwood joins raw field values directly. The router at row 1495 switches between these paths.
- **Row 36 (Top Details):** Stone auto-populates "3/4 Plywood Substrate Painted Black". Hardwood auto-populates "Hospitality Grade Protective Finish". Both happen via auto-populate formulas at rows 87–88.
- **Row 37 (Base Description):** Three paths — "Table Top Only" / stock base JOIN / custom base JOIN — selected by base type at row 49.

**Edge label switching:** The edge description at row 35 uses a smart label: if the edge profile is "Metal Edge Band", the label reads "Edge Detail:" instead of "Edge Profile:". This prevents the confusing output "Edge Profile: Metal Edge Band."

**Bases Per Top:** Only included in the base finish description (row 38) when >1. A table with 1 base doesn't need "1 Bases Per Top" cluttering the description.

### 10.3 Dynamic Dropdown System — Context-Sensitive Material Lists

The Material (row 72) and Style/Manufacturer (row 73) dropdowns use **CHOOSECOLS** to pull different options from the Inputs sheet based on what material type is selected.

**How it works:** The Inputs sheet has a lookup table where each column represents a material type category. When E47 = "Hardwood", the CHOOSECOLS formula pulls column A (Ash, Red Oak, Walnut...). When F47 = "Stone 1", column F pulls column B (Quartz, Terrazzo, Granite...).

**Why this matters:** Each product column gets its own context-appropriate dropdown list. In a single job, Product E (hardwood) sees wood species while Product F (stone) sees stone types — without any manual switching. The DV range at rows 72–73 points to the reference section, where each product column has already resolved to the right options.

**Unfinished expansion:** Three additional dropdown sections (Stain/Color at row 1571, Color Name at row 1576, Sheen at row 1584) were planned to use the same CHOOSECOLS pattern but were never completed. The intent was for these to also vary by material type — e.g., stone products might offer "Polished / Honed / Leathered" while hardwood offers "Matte / Satin / Semi Gloss". Currently these dropdowns use inline (hardcoded) DV lists that don't adapt. The empty placeholder rows are kept for future completion.

### 10.4 Conditional Formatting Validation Layer

11 CF rules use hidden helper formulas in the reference section to highlight missing or mismatched data in the spec rows. This is a deliberate design choice — putting the validation logic in helper formulas rather than inline CF formulas keeps the CF rules simple and makes the validation logic traceable.

**Key validation patterns:**
- **Incomplete pair detection:** Custom height selected but no value entered; custom shape selected but no description; hardwood selected but no thickness. These use a "sum of conditions = 1" pattern where exactly one condition being true means the pair is incomplete.
- **Material-context warnings:** Stone products shouldn't have stain/color; hardwood should have grain direction. CF hides or highlights fields based on material type.
- **Cross-field consistency:** Lumber thickness (row 48) should match edge thickness (row 80). When they differ, row 80 highlights red.
- **Base type validation:** Stock base products should have stock base fields filled (not custom base fields), and vice versa. Yellow highlight warns when fields are filled for the wrong base type.

### 10.5 Old Pricing Calculator — Manual Reference Tool

Rows 1387–1396 contain a legacy pricing calculator that computes what the old quote sheet would have priced a hardwood table at. No downstream formulas reference it — Colin uses it visually as a sanity check when adjusting final pricing on hardwood products. It still has live formulas referencing the current species key and Inputs sheet pricing data, so it auto-updates with the current job's values.

Note: Uses an outdated 1.2× waste factor (current system uses 1.3×), so its output will be slightly lower than the current system's cost basis.

---

## CHANGELOG

| Date | Section | Change |
|------|---------|--------|
| 2026-02-09 | Initial | Created from formula crawl + first voice interview |
| 2026-02-09 | §1, §2 | Added pricing philosophy and group cost logic from Colin's explanation of distribution types, checkbox gating, and per-unit resolution |
| 2026-02-09 | §3, §4, §6 | Added margin rate business logic: profit source determines markup level, rates adjustable per job, stone markup applies regardless of vendor labor split, stock bases are pure resale |
| 2026-02-09 | §3 | Waste factor: 1.25× on base is a known discrepancy, should be 1.3× like tops |
| 2026-02-09 | §4 | Base type reflects source not labor intensity. Stock base stays stock even with heavy mods. Custom base covers metal, wood, and subcontracted. Metal worksheet is sizing tool not costing tool |
| 2026-02-09 | §6 | Final Adjustment Rate: bidirectional price multiplier, preserves hours. Rep commission: 8% standard, territory-based, not every job |
| 2026-02-22 | §1 | Added Aggregation Levels subsection documenting PU/PB/PP/PT/Total hierarchy |
| 2026-02-22 | §3 | Added Hardwood Cost Split subsection: top vs base cost tracked separately at pricing level |
| 2026-02-22 | §5 | Added Two Structural Tiers, Panel Data Section clarification, expanded Tag System architecture |
| 2026-02-22 | §7 (was §6) | Added Dual-Track Pricing Analysis |
| 2026-02-22 | §8 (was §7) | Named Range Naming Conventions |
| 2026-02-22 | §2 | **New section: The Three Block Patterns.** Unit Block, Group Block, Rate Block as the three fundamental patterns. Checkbox gate as optional modifier. Count-by-pattern summary table |
| 2026-02-22 | §4, §5 | Updated Base Types and Labor Centers to reference block pattern names |
| 2026-02-22 | §6 | **New section: How the Three Patterns Map to the Full Sheet.** Material cost pattern table, hours pattern table showing exact block composition of each LC |
| 2026-02-22 | §8 | Updated naming conventions to reference block pattern names alongside block type prefixes |
| 2026-02-23 | §10 (new) | **New section: Reference Section Architecture.** Five subsystems documented from cleaned file analysis + placeholder data trace: Species Key System (§10.1), Description Autofill Engine (§10.2), Dynamic Dropdown System (§10.3), CF Validation Layer (§10.4), Old Pricing Calculator (§10.5) |
| 2026-02-23 | §3 | Updated Hardwood Path with species key cross-reference (§10.1) and description engine cross-reference (§10.2) |
| 2026-02-23 | §3 | Updated Stone Path with description engine (§10.2) and dynamic dropdown (§10.3) cross-references |
| 2026-02-23 | §9 | Added placeholder data observations: 8 products configured showing multi-material job pattern |
| 2026-02-23 | §10.3 | Documented unfinished dropdown expansions (stain/color/sheen) — kept for future completion, no deletion |
| 2026-02-23 | §10.5 | Documented old pricing calculator as intentional manual reference tool (not dead code) |
| 2026-03-15 | §3, §3.1 (new) | **Terrazzo workflow fully documented** from Colin interview. Expanded Stone Path summary; added §3.1 with full mix recipe, pour/form sizing logic, pigment rules (5% combined cap, per-color maxes), material cost breakdown, per-job flat costs, $/sq ft reference table, and sheet integration notes |

---

## 11. STOCK BASE CATALOG SYSTEM *(verified — working March 2026)*

### 11.1 Overview

The stock base catalog is a separate Google Sheet that stores purchase prices, specifications, and vendor information for all stocked table bases. It replaces manual price entry for the `P_SB_CostPB` field and provides a structured, maintainable source of truth for base pricing that grows as new vendors are added.

**Why a separate sheet, not the Presets spreadsheet:**
The catalog is a *product database*, not a preset configuration. It has hundreds of rows (one per purchasable SKU), a row-per-product orientation, and will grow significantly. The Presets spreadsheet is column-oriented and tightly structured for the preset engine parser — mixing catalog data there would be architecturally messy.

### 11.2 Catalog Structure

**Sheet: "Base Catalog"** in the catalog workbook. Data starts at row 3 (rows 1–2 are headers).

| Column | Field | Notes |
|--------|-------|-------|
| A | **Auto-Built Lookup Key** | Formula: `=B&"|"&C&"|"&D&"|"&E&"|"&F&"|"&G&"|"&H&"|"&I` — updates live if any field changes. This is what the script matches against. |
| B | Vendor | NOROCK / JI Bases / PMI |
| C | Style / Series | e.g. Trail, X Base, TR-Edge Round |
| D | Size | e.g. "22\"", "22x30\"", "22\" Rd" |
| E | Height | Dining / Bar / Counter / Modified / Coffee / Lounge |
| F | Finish / Color | e.g. "Black (Standard)", "Black NL (Next-Level)", "Brushed Stainless (#304)" |
| G | Column (JI Only) | "3\"" / "4\"" / blank for non-JI |
| H | Top Plate (JI Only) | "TP12 (13\")" / "TP17 (17\")" / blank for non-JI |
| I | Footring (JI Only) | "None" / "Yes (19\" dia)" / "Yes (22\" dia)" / blank for non-JI |
| J | Item Code / SKU | Vendor product code |
| K | Tariff % | Applied tariff rate (e.g. 0.18 for JI stainless, 0.43 for PMI steel) |
| L | List Price (pre-tariff) | Price 101 / vendor list before tariff |
| M | **Final Price** | Formula: `=IF(K="", L, ROUND(L*(1+K), 2))` — this is what gets written to P_SB_CostPB |
| N | Height Modifier $ | For Modified heights — cutting charge entered manually per row |
| O | Notes | Lead times, special conditions, tariff notes |

**Lookup key format:** `Vendor|Style|Size|Height|Color|JI_Col|JI_TP|JI_FR`
For non-JI bases the last three segments are empty strings: `NOROCK|Trail|22"|Dining|Black (Standard)|||`

### 11.3 Vendor Coverage (as of March 2026)

| Vendor | Families | Price Date | Tariff Status |
|--------|----------|------------|---------------|
| NOROCK | Esplanade, Lunar, NRxTMH, Parkway, Parkway T-Base, Sol, Terrace, Trail, Trail T-Base | Oct 2025 | No tariff on list prices |
| JI Bases | X Base, T-Base (2-Prong), 3-Prong End, Round (Cast Iron), Round (Stainless), Bolt-Down, Cantilever, Pin Leg | Aug 2024 | Cast iron: no tariff. Stainless: 18% tariff applied in Final Price column |
| PMI (Peter Meier) | X-Style, Arc, Dome Round, TR-Edge Round, Round (BKZ/SS), Square (BKZ/SS), Aluminum Trumpet, Ornamental, DEC, Bolt-Down, Cantilever, Nesting, Lift | Oct 2025 | 23–51% by product family, applied in Final Price column |

**JI pricing model is unique:** JI Bases uses an additive/modular pricing structure — the catalog pre-computes all permutations (base plate + column upgrade + top plate upgrade + bar height + footring combinations) so every possible configuration has its own row with a pre-summed price. No math happens at quote time.

### 11.4 Script Integration (stock_base_selector_v2.js)

Two menu actions under **Quote Tools → Stock Base:**

**Load Base Options**
- Trigger: Check `P_SB_PriceLookup_LoadOptions` checkbox in the product column, run menu action
- Reads Vendor + Style from that column
- Filters catalog to matching rows
- Extracts unique valid values for Size, Height, Color, JI fields
- Sets data validation dropdowns on those cells (only valid options shown)
- Auto-fills any field that has only one valid option
- Clears and unlocks JI-only fields for non-JI vendors
- Unchecks checkbox when done

**Run Base Actions**
- Trigger: Check `P_SB_PriceLookup_RunActions` checkbox in the product column, run menu action
- Reads all 8 selector fields, builds the lookup key
- Matches against column A of the catalog (single-column MATCH — fast regardless of catalog size)
- Writes Final Price (col M) to `P_SB_CostPB`
- Unchecks checkbox when done
- **Phase 2 placeholder:** Additional writes (shipping, hours, description fields) to be added

**Performance design:** The script loads the catalog once per run (batch read), not once per product column. For `runBaseActions()`, only columns A and M are read (not all 15 columns). The pre-computed key in column A means the MATCH is a simple string comparison — no array formula evaluation across multiple columns.

### 11.5 Named Ranges (Pricing Sheet, Rows 93–102)

All follow the `P_SB_PriceLookup_` prefix. Script resolves row numbers via `getRangeByName()` — not hardcoded row numbers — so these rows can be moved in the sheet without breaking the script.

| Named Range | Row | Purpose |
|-------------|-----|---------|
| P_SB_PriceLookup_Vendor | 93 | Vendor selector — static dropdown |
| P_SB_PriceLookup_Style | 94 | Style selector — static dropdown (full list; script filters after load) |
| P_SB_PriceLookup_LoadOptions | 95 | Checkbox trigger for Load Base Options |
| P_SB_PriceLookup_Size | 96 | Size — dynamically loaded |
| P_SB_PriceLookup_Height | 97 | Height — dynamically loaded |
| P_SB_PriceLookup_Color | 98 | Finish/Color — dynamically loaded |
| P_SB_PriceLookup_JI_ColumnSize | 99 | JI column diameter — loaded/cleared by vendor |
| P_SB_PriceLookup_JI_TopPlate | 100 | JI top plate size — loaded/cleared by vendor |
| P_SB_PriceLookup_JI_FootRing | 101 | JI footring option — loaded/cleared by vendor |
| P_SB_PriceLookup_RunActions | 102 | Checkbox trigger for Run Base Actions |

These ranges are included in `P_FIELDS` in the master script so they're part of the field cache. They are NOT included in `SB_SELECTOR_RANGES` used for the price lookup key (LoadOptions and RunActions are checkbox triggers, not data fields).

### 11.6 Open Items / Phase 2

- **Phase 2 of Run Base Actions:** Write shipping cost/checkbox, receiving hours (LC110), packing hours (LC111), and base description fields from catalog columns to be added
- **Vendor + Style static dropdowns:** Need data validation set in the Pricing sheet for rows 93–94 (currently free-text input)
- **Catalog ID in central config:** `BASE_CATALOG_SS_ID` is currently hardcoded in the script; should be moved to the "Master Sheet Info Pull" config tab in the Presets spreadsheet (same pattern as Airtable token)
- **Additional vendors:** More vendor price lists to be entered as obtained
- **Modified height modifier:** The Height Modifier $ column (N) in the catalog is reserved for cut-down charges but not yet wired into the Run Base Actions write


| 2026-03-17 | §11 (new) | **New section: Stock Base Catalog System.** Catalog structure, vendor coverage (NOROCK/JI Bases/PMI), script integration (Load Base Options + Run Base Actions), named range table (rows 93–102), performance design, and Phase 2 open items documented. |
