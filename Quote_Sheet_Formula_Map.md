# Quote Sheet Formula Map — V5 Pricing Sheet

**Generated: February 8, 2026**
**Updated: February 23, 2026** — Reference section rewrite with new row numbers from cleaned file
**Source: V5_Master_Quote_Sheet_Feb_2025_placeholder_Data.xlsx**
**Sheet: Pricing 1 (1,595 rows × 22 columns, A–V)**

---

## ARCHITECTURE OVERVIEW

### Column Structure
- **A:** Row labels / section names / distribution type selectors / tag dropdowns
- **B:** Subtotals, rates, reference notes
- **C:** Job-level totals (SUM across E:V)
- **D:** RowKey identifiers (P_Quantity, P_MaterialType, etc.) + formulas that mirror E for column D itself
- **E–V:** Product columns P_1 through P_18

### Formula Conventions
- `PP` = Per Product (per table)
- `PT` = Per Total (×quantity)
- `PB` = Per Base (per base unit)
- `PU` = Per Unit (single piece/hour)
- `E$39` = Quantity (always row-locked)
- `E$50` = Bases Per Top (always row-locked)
- `E$55` = Top SqFt PP *(note: E$54 is BdFt PP)*
- `E$56` = Top SqFt IF Round (adjusted for DIA shapes)

### Aggregation Hierarchy *(verified)*
```
PU/PB → PP → PT → Total (job)
         ↑ fundamental level    ↑ SUM(E:V)
```
Every cost and hours calculation resolves to PP first. PT = PP × Qty. Total = SUM of PT across products. The quote sheet displays PP as the unit price.

### Input vs Formula Cells
- **White cells** = manual input (the ~207 writable fields per product column)
- **Light yellow cells** = formula cells (never touched by presets or scripts)

### Cell Type Distribution *(from registry analysis, 1,045 ranges)*
| Type | Count | Description |
|------|-------|-------------|
| Formula | 637 | Calculated from other cells — never write to these |
| Input | 365 | Manual entry — these are the writable fields |
| Checkbox | 43 | Boolean toggles (TRUE/FALSE) — gate calculations on/off |
| Dropdown | 103 | Input with data validation list — constrained choices |

### The Three Block Patterns
Nearly every calculation block in the sheet follows one of three fundamental patterns (see Domain Knowledge §2 for full explanation):
- **Unit Block** (330 ranges): value × multiplier → PP. Used by UC, UCB, PowderCoat, Stock Base, Species, Stone, UH slots, HWB Builder
- **Group Block** (245 ranges): lump sum ÷ proportional → PP. Used by GC, GCB, SB Shipping, Misc, Consumables, GH slots
- **Rate Block** (93 ranges): metric ÷ rate → proportional hours. Used by LC101–LC109 sub-blocks
- Checkbox gates are optional modifiers on any pattern (marked "gated" in registry)

---

## SECTION 1: SPECS & CONFIGURATION (Rows 1–330)

### Project Info (Rows 1–19)
- Row 2: Project Name, Deal ID pulled from `=MASTER!B2`, `=MASTER!B3`
- Rows 4–9: Rep info (Yes/No toggle at B4, commission rate at C4 = 0.08)

### Presets (Rows 20–30)
- 5 preset slots with checkbox/ID pairs per product column
- Checkboxes in odd rows (21,23,25,27,29), IDs in even rows (22,24,26,28,30)

### Product Configuration (Rows 31–50) — ALL INPUTS
| Row | Field | RowKey | Example |
|-----|-------|--------|---------|
| 31 | Title | P_Title | "Table 1" |
| 32 | Overall Dimensions | P_OverallDimensionName | Formula: autofill from shape logic |
| 39 | **QUANTITY** | P_Quantity | 2 |
| 41 | Width | P_Width | 24 |
| 42 | Length (Grain Direction) | P_Length | 30 |
| 43 | Height | P_HeightName | "Dining Height" |
| 44 | Custom Height | P_HeightInput | (blank unless custom) |
| 45 | Shape | P_Shape | "Standard" |
| 47 | **Material Type** | P_MaterialType | "Hardwood" / "Stone 1" / "Live Edge" |
| 48 | Lumber Thickness | P_LumberThickness | "1.25" |
| 49 | **Base Type** | P_BaseType | "Stock Base" / "Custom Base" / "Top Only" |
| 50 | **Bases Per Top** | P_BaseQtyPP | 2 |

### Derived Size Data (Rows 51–68) — FORMULAS
| Row | Field | Formula Logic |
|-----|-------|---------------|
| 53 | Wood Thickness Raw | `=E1414` (XLOOKUP from lumber thickness table in reference section) |
| 54 | **Top BdFt PP** | `=((Width × Length × ThicknessRaw) / 144) × 1.3` (30% waste factor) |
| 55 | **Top SqFt PP** | `=(Width/12) × (Length/12)` |
| 56 | SqFt if Round | `=IF(Shape="DIA", (Width/2)²×π/144, SqFt)` |
| 57 | Top SqFt PT | `=SqFtPP × Quantity` |

### HWB Summary Data (Rows 59–69) — FORMULAS *(verified)*
These rows summarize the Hardwood Base Builder component data for use by downstream sections (panel calculations, species distribution). Each component (Plank, Leg, Apron) has:
- SqFt PP, SqFt PT, Pieces PT
- Combined totals: `P_HWB_SqFtPP` (all components), `HWB_SqFt_Total`

> **Name history:** These ranges were renamed from `P_HB_`/`P_BH_` to `P_HWB_`/`HWB_` during the Named Range Map rebuild. Old names may appear in registry History column.

### Description Autofill (Rows 32–38)
Formulas that build customer-facing descriptions from downstream reference section (rows 1481–1544). These feed directly into the Quote sheet.

| Row | Field | Formula Source | Output Example |
|-----|-------|---------------|----------------|
| 32 | Overall Dimensions | `=IF(E1541<>"", JOIN(E1540, E1541), E1540)` | "36" x 36" - Bar Height" or "30" DIA - Dining Height" |
| 34 | Top Material + Finish | `=E1495` (routes HW vs non-HW join) | "Solid Red Oak - Mixed Plank - Natural Color - Matte" |
| 35 | Top Edge | `=E1503` (edge join) | "Top Thickness: 1.25" - Edge Profile: Eased Edge" |
| 36 | Top Details | `=E1512` (special descriptions join) | "Hospitality Grade Protective Finish - Grain Direction: Length" |
| 37 | Base Description | `=IF(E49="Top Only","Table Top Only", IF(E49="Stock Base",E1525,E1527))` | Stock: "Dining Height - Round - 22" DIA" / Custom: "Hardwood + Metal" |
| 38 | Base Finish | `=IF(E49="Top Only","",E1534)` | "Powder Coat - Feet: Adjustable Glides - 2 Bases Per Top" |

### Auto-Populate Description Fields (Rows 87–88) — FORMULAS
Two rows that auto-fill based on material type, feeding into the description chain via rows 1507–1508:
- Row 87 (`P_Desc_Stone_Substrate`): `=IF(stone_flag=1, "3/4 Plywood Substrate Painted Black", "")` — auto-fills for any Stone material type
- Row 88 (`P_Desc_Hardwood_Finish`): `=IF(or(E47="Hardwood",E47="Live Edge"), "Hospitality Grade Protective Finish", "")` — auto-fills for hardwood/live edge

### Table Top Description (Rows 69–90) — MOSTLY INPUTS
Material, style, stain, color, sheen, edge profile, custom descriptions, grain direction. These are display/description fields, not calculation drivers.

Key dropdowns *(verified)*:
- `P_MaterialTop`: Material selection — **dynamic dropdown** from reference rows 1552–1561 (see §5 Dynamic Dropdowns)
- `P_Desc_StyleORManufacturer`: Brand/style — **dynamic dropdown** from reference rows 1563–1570 (see §5 Dynamic Dropdowns)
- `P_Desc_StainORColor`: Natural Color / Stain / Dye / Custom Print *(inline DV, not from reference section)*
- `P_Desc_SheenORFinish`: Matte / Satin / Semi Gloss / Gloss / Polished / Leathered / Honed / Embossed *(inline DV)*
- `P_Desc_EdgeProfile`: Eased Edge / Reverse Chamfer / Bullnose / Ogee / Custom / etc. *(inline DV)*
- `P_Desc_GrainDirection`: Length / Width / N/A *(inline DV)*

### Base Description (Rows 91–118)
Stock base: vendor, outdoor flag, type, style, plate size, column, top plate.
Custom base: material, style, size, custom descriptions.
Base finish: material, type, color, details, feet type.

### Hardwood Base Material Builder (Rows 131–201) — INPUTS + FORMULAS
Four sub-components, each with the same pattern:

**Plank (Rows 132–147):**
- Inputs: Width, Length, Thickness, QtyPerBase, Material (dropdown: species), LumberThicknessRaw (dropdown: 1/1.5/2)
- `MaterialLumber`: `=E1422` — lookup combining species + thickness from reference section
- `BdFtPerPiece`: `=(W×L×T/144)×1.25` (25% waste — known discrepancy, should be 1.3×)
- `TotalPieces`: `=QtyPerBase × BasesPerTop × Quantity`
- `BdFtPP`: `=BdFtPerPiece × QtyPerBase × BasesPerTop`
- `BdFtPT`: `=BdFtPP × Quantity`

**Leg/Beam (Rows 149–164):** Same pattern.

**Apron Length (Rows 166–183):** Same pattern with length pieces.

**Apron Width (Rows 185–201):** Same pattern with width pieces.

### Metal Base Material Worksheet (Rows 204–330)
Three laser-cut part sections (Part 1/2/3), each with shape/square area calculations and totals. Then metal edgeband and tube/pipe sections. All feed into metal fabrication hours and costs downstream.

---

## SECTION 2: MATERIAL COSTS (Rows 336–729)

### Species / Lumber Cost System (Rows 336–520)

**Flow:** Material inputs → Lumber thickness lookup (row 1404+) → Species key generation (row 1411+) → Species distribution → Board foot calculation → Cost per species

**Lumber Thickness Lookup (Rows 1404–1410):**
- Table of thickness values (1", 1.25", 1.5", 1.75", 2", 2.25", 2.5") mapping to raw lumber dimensions and shorthand quarter codes (4/4, 6/4, 8/4, 10/4)
- XLOOKUP at row 1414 resolves user-entered thickness string to numeric raw value
- XLOOKUP at row 1415 resolves to quarter code string
- Row 1416 generates "Material Key" like "Red Oak 6/4" by joining validated species + quarter code (see §5 Species Key Generation)

**Species Distribution (Rows 355–435):**
- Rows 360–378: Collect material keys from top, plank, leg, apron L, apron W
- Rows 380–435: For each of 8 possible species, check which base components use that species and sum their BdFt
- Uses IF matching: `=IF($B380=E$364, E$365, "")` — if Species 1 name matches the plank material, include plank BdFt

**Species Cost Blocks (Rows 437–514):** 6 species blocks (expandable to 8), each with:
- Row N: Species name (array formula from unique species list)
- `P_SpeciesN_Top_BdFtPP`: `=if(SpeciesName = MaterialKey, TopBdFt, "")`
- `P_SpeciesN_HB_BdFtPP`: Sum from distribution rows (base component board feet)
- `P_SpeciesN_BdFtPP`: `=if(Qty>0, Top + Base, 0)` — total BdFt for this species per product
- `P_SpeciesN_CostPP`: `=BdFtPP × PricePerBdFt`
- `P_SpeciesN_BdFtTotal`: `=BdFtPP × Quantity`
- `SpeciesN_PricePerBdFt` (B column): INPUT — e.g., $2.00/bdft for Ash
- `P_SpeciesN_CostPT`: `=BdFtTotal × PricePerBdFt`

**Hardwood Totals (Rows 516–520):**
- `Hardwood_TotalBdFt`: Sum of all 6 species BdFt totals
- `P_Hardwood_CostPP`: Sum of all species CostPP
- `P_Hardwood_CostPT`: Sum of all species CostPT
- `P_Hardwood_BH_CostPP`: Base hardwood cost per product *(feeds into Custom Base Cost margin, not Hardwood margin)*
- `P_Hardwood_BH_CostPT`: Base hardwood cost total
- `P_Hardwood_TopCostPP`: Top-only hardwood cost *(feeds into Hardwood margin calculation in §4)*

### Stone Costs (Rows 521–544)
Three stone slots (Stone 1/2/3), each with:
- `P_StoneN_SqFtPP`: `=if(MaterialType="Stone N", TopSqFt, "")` — activated by material type match
- `P_StoneN_SqFtPT`: `=if(SqFtPP<>"", SqFtPP × Qty, "")`
- `StoneN_TotalSqFt`: `=SUM(E:V)` — job total
- `StoneN_CostInput` (C column): INPUT — total stone cost for job
- `StoneN_CostPerSqFt`: `=CostInput / TotalSqFt` — effective rate
- `P_StoneN_CostPP`: `=if(SqFtPP<>"", SqFtPP × CostPerSqFt, "")` — distributed back to products
- `P_StoneN_CostPT`: `=if(CostPP<>"", CostPP × Qty, "")`
- `P_Stone_CostPP`: Sum of all 3 stone slots

### Stock Base Costs (Rows 545–579)

**Stock Base (Row 564):** — "Unit Block" (CostPB × BasesPerTop)
- `P_SB_CostPB`: INPUT — unit cost per base (e.g., $255)
- `P_SB_CostPP`: `=if(CostPB=0, "", CostPB × BasesPerTop)`
- `P_SB_CostPT`: `=if(CostPB=0, "", CostPB × BasesPerTop × Qty)`

**Stock Base Shipping (Rows 568–570):** — "Group Block"
- `GC_SB_Shipping_TotalCost` (C column): INPUT — total shipping cost
- `P_SB_Shipping_Check`: Checkbox per product
- `GC_SB_Shipping_Type` (A column): Dropdown — "Sq Ft" / "Units" / "Bd Ft"
- `P_SB_Shipping_TypePT`: `=IF(Check=true, ifs(Type="Units", Qty×BasesPerTop, Type="Sq Ft", SqFt×Qty, Type="Bd Ft", BdFt×Qty), "")`
- `P_SB_Shipping_CostPP`: `=IF(Check=TRUE, TypePT/Qty × Rate, "")`

**Powder Coating 1 & 2 (Rows 572–579):** — "Unit Block" (CostPB × BasesPerTop)
- `P_PowderCoat1_PB`: INPUT — unit cost per base
- `P_PowderCoat1_PP`: `=if(PB=0, "", PB × BasesPerTop)`
- `P_PowderCoat1_PT`: `=PP × Quantity`

### Unit Costs - Base (UCB, Rows 581–607) — "Unit Block"
4 slots (UCB1–UCB4). Each follows the Unit Block pattern with BasesPerTop as multiplier:
- `P_UCBn_Description`: INPUT — text
- `P_UCBn_PB`: Cost per base (INPUT)
- `P_UCBn_PP`: `=if(PB=0, "", PB × BasesPerTop)`
- `P_UCBn_PT`: `=if(PB=0, "", PB × BasesPerTop × Qty)`
- Rollup: `P_UCB_CostPP = SUM(UCB1..UCB4 PP values)`

### Group Costs - Base (GCB, Rows 609–627) — "Group Block"
4 slots (GCB1–GCB4). Uses the **GROUP COST** pattern (see below).

### ⚙️ GROUP COST PATTERN — "Group Block" (Used by GC, GCB, Stock Base Shipping, Consumables, Misc, and all Group Hours)

This is one of the three fundamental block patterns in the sheet (see Domain Knowledge §2). It distributes a lump-sum cost or hours value across multiple products proportionally.

**Three-row structure per slot:**

| Row | Content | Example (P_GC1) |
|-----|---------|-----------------|
| Row 1 | **Checkbox** (column E per product) + **Total value** (column C) + **Description** (column A) | ☑ in products 1–5, $300 in C |
| Row 2 | **Type metric** — calculated per product. Type set in column A label. | "Sq Ft" → `=SqFtPP × Quantity` for checked products, "" for unchecked |
| Row 3 | **Cost/Hours PP** — the per-unit-table result + **Tag** (column A, for GH blocks only) | `= (ThisProduct'sMetric / Quantity) × Rate` |

**Exact formulas *(verified from registry analysis)*:**
```
Row 2 (TypePP): =IF(Check=true, ifs($A="Units", Qty, $A="Sq Ft", SqFt×Qty, $A="Bd Ft", BdFt×Qty), "")
Row 3 (CostPP): =IF(Check=TRUE, TypePP/Qty × Rate, "")
```

**Rate derivation (column B, row 3):**
```
Rate = TotalValue(C) ÷ SUM(TypeMetric across all checked products)
     = C_row1 / B_row2
```
Example: $300 ÷ 150 total sqft = $2.00/sqft

**Distribution types (set via the label in column A of the type row):**
- **Units** — distributes evenly by quantity (`TypePP = Quantity`)
- **Sq Ft** — distributes proportionally by table top size (`TypePP = SqFtPP × Quantity`)
- **Bd Ft** — distributes proportionally by board footage (`TypePP = BdFtPP × Quantity`)

**Why the result row is per-unit (not per-total):**
The entire pricing architecture resolves to a per-table price. The Quote sheet displays `Unit Price × Quantity = Line Total`. So group costs must resolve to a single-table value. Quantity multiplication happens downstream at row 1279/1283 or on the Quote sheet.

**Why checkboxes exist:**
Not all products share every cost pool. Example: 5 tables have stock bases with $300 shared shipping, but a 6th table has a custom in-house base. The checkbox gates which products participate in the distribution, so the 6th table isn't burdened with shipping cost it didn't incur.

**Group Hours variant:** Same three-row pattern, but distributes hours instead of cost. The GH slots within labor centers use "Sq Ft" or "Units" only (no "Bd Ft" option). GH slots also have a **Tag dropdown** in column A of the rate row for cost allocation (see §5 Tag System in Domain Knowledge).

### Unit Costs - Project (UC, Rows 631–685) — "Unit Block"
9 slots (UC1–UC9). Each slot follows the Unit Block pattern (value × multiplier → PP):
- `P_UCn_Description`: INPUT — product-level description (e.g., "power unit", "grommet")
- `UCn_Description`: INPUT — job-level label (column A)
- `P_UCn_CostPU`: Unit price (INPUT)
- `P_UCn_UnitsPP`: Quantity per table (INPUT)
- `P_UCn_CostPP`: `=if(CostPU=0, "", CostPU × UnitsPP)`
- `P_UCn_CostTP`: `=IF(or(CostPU=0, CostPU="enter unit price here"), "", CostPP × Qty)` *(guarded)*
- Rollups: `P_UC_CostPP` = SUM(UC1..UC9 CostPP), `P_UC_CostPT`, `UC_TotalCost`

> **Note:** UC has both product-level (`P_UCn_Description`) and job-level (`UCn_Description`) description fields. The product-level one allows different descriptions per product column; the job-level one in column A is a shared label.

### Group Costs - Project (GC, Rows 686–718) — "Group Block"
6 slots (GC1–GC6). Same GROUP COST pattern as GCB:
- Checkbox, total in C, distribution type in A, proportional allocation
- Rollups: `P_GC_CostPP`, `P_GC_CostPT`, `GC_TotalCost`

### Misc & Consumables (Rows 719–726) — "Group Block"
Both use the GROUP COST pattern with checkbox activation.
- Misc: `P_Misc_Check`, `Misc_TotalCost`, `Misc_Type`, `P_Misc_CostPP`, `P_Misc_CostPT`
- Consumables: `P_Consumables_Check`, `Consumables_TotalCost`, `Consumables_Type`, `P_Consumables_CostPP`, `P_Consumables_CostPT`

### **TOTAL COST ROLLUP (Row 728)**
```
P_CostPP = SUM(Consumables, Misc, GroupCosts, UnitCosts, BaseCosts, Stone, Hardwood)
         = SUM(E725, E721, E717, E684, E629, E543, E517)
```
This is the total material cost per table **before** margin markup and **before** hours.

- `Worksheets_TotalCost`: `=SUM(C724,C720,C718,C685,C630,C544,C518)` — job-level sum in column C
- `P_CostPT`: `=if(CostPP×Qty=0, "", CostPP × Qty)`
- `Worksheets_TotalCost_ValueCheck`: Cross-check formula

---

## SECTION 3: HOURS / LABOR (Rows 730–1177)

### Panel Data Layer (Rows 735–762) — SHARED FEEDER, NOT A LABOR CENTER *(verified)*

This section calculates panel counts and square footage that feed multiple downstream labor centers (LC101, LC102, LC103, LC104, LC106). It does NOT calculate hours itself.

**Three checkbox-gated panel types:**

| Type | Check Range | Panel Count | SqFt PP | SqFt PT |
|------|-------------|-------------|---------|---------|
| Top Panels | `P_Hours_PanelTop_Check` | `=IF(check, Qty, "")` | `=IF(check, TopSqFt, "")` | `=IF(check, Qty×SqFt, "")` |
| HB Plank Panels | `P_Hours_HBPlank_Check` | `=IF(check, PlankPiecesPT, "")` | `=IF(check, PlankSqFtPP, "")` | from HWB summary |
| HB Leg Panels | `P_Hours_HBLeg_Check` | `=IF(check, LegPiecesPT, "")` | `=IF(check, LegSqFtPP, "")` | from HWB summary |

**Combined totals:**
- `P_Hours_HBPanels_TotalPT`: `=SUM(Plank + Leg panel counts)`
- `P_Hours_HBPanels_SqftPP`: `=SUM(Plank + Leg sqft)` — only if >0
- `P_Hours_Panels_SqftPP`: `=SUM(Top + Plank + Leg sqft)` — total panel sqft per product
- `P_Hours_Panels_SqftPT`: `=SUM(TopSqFtPT + HBSqFtPT)`

**Job-level totals (column C):**
- `Hours_TotalPanels`, `Hours_AvgSqftPerPanel`, `Hours_PanelTop_TotalSqFt`, `Hours_Panels_TotalSqft`

### Labor Center Pattern

#### Two Structural Tiers *(verified)*

**Tier 1 — Pure Rate-Based (LC101, LC102):**
No UH/GH sub-blocks. No tag system. Simple proportional distribution:
```
TotalHours = TotalSqFt ÷ Rate(sqft/hr)
TimePerSqFt = TotalHours / TotalSqFt
P_LCnnn_HoursPP = Product's PanelSqFtPP × TimePerSqFt
P_LCnnn_BasePP = Product's BaseSqFtPP × TimePerSqFt  (base portion only)
```
These are the only LCs with a `BasePP` field — it separates base panel hours for analysis.

**Tier 2 — Full Component Structure (LC103–LC111, LC100):**
Some or all of:
1. **Rate-based sub-blocks** (Rate Block, gated) — panels/hr or sqft/hr, with per-block checkboxes
2. **Unit Hours (UH1, UH2)** (Unit Block) — direct hour input per table. `HoursPU` (input) → `HoursPT = PU × Qty` → `HoursPP = PU` (just passes through)
3. **Group Hours (GH1, GH2)** (Group Block) — same GROUP COST pattern, distributing lump-sum hours proportionally
4. **Tag summary rows** — aggregate hours by tag label (Base/Feature1/Feature2) across all sub-blocks
5. **LC total** — `P_LCnnn_HoursPP = SUM(all sub-blocks)`, `P_LCnnn_HoursPT = HoursPP × Qty`

#### LC101 Processing (Rows 763–772) — TIER 1 (single Rate Block)
- Rate: SqFt per hour (B771, e.g., 14)
- `LC101_TotalSqFt`: `=B$762` (from Panel Data)
- `LC101_TotalHours`: `=TotalSqFt / Rate`
- `LC101_TimePerSqFt`: `=TotalHours / TotalSqFt`
- `P_LC101_HoursPP`: `=iferror(if(PanelsSqftPP × TimePerSqFt = 0, "", PanelsSqftPP × TimePerSqFt), "")`
- `P_LC101_BasePP`: `=iferror(if(BaseSqftPP × TimePerSqFt = 0, "", BaseSqftPP × TimePerSqFt), "")`

#### LC102 Belt Sanding (Rows 773–778) — TIER 1 (single Rate Block)
Same pattern as LC101, different rate (B777, e.g., 30 sqft/hr)

#### LC103 Cutting (Rows 779–816) — TIER 2, MOST COMPLEX (3 Rate gated + 1 Unit + 1 Group)
Five sub-blocks, the most of any LC:

**TopPanel sub-block:**
- `P_LC103_TopPanel_Check`: Checkbox
- `P_LC103_TotalTopPanels`: `=IF(check, Qty, "")`
- `LC103_TopPanel_Rate` (B783): INPUT — panels/hr
- `P_LC103_TopPanel_HoursPP`: `=IF(AND(panels<>"", check=True), Rate, "")`
- `LC103_TopPanel_TotalHours`: `=TotalPanels / Rate`
- `LC103_TopPanels_Tag`: Dropdown — tag allocation

**HBPanels sub-block:**
- Two checkboxes: `P_LC103_HBPlank_Check`, `P_LC103_HBLeg_Check`
- `P_LC103_HBPanels_PanelsPT`: `=if((IF(PlankCheck, PlankPanels, "") + IF(LegCheck, LegPanels, "")) = 0, "", sum)`
- `LC103_HBPanels_Rate` (B789): INPUT — panels/hr
- `P_LC103_HBPanels_HoursPP`: `=IF(AND(panels<>"", or(checks)), (PanelsPT/Qty) × Rate, "")`

**OtherPanels sub-block:**
- `P_LC103_OtherPanels_PanelsPP`: INPUT — manual panel count per product
- `LC103_OtherPanels_Rate` (B796): INPUT — panels/hr
- `P_LC103_OtherPanels_HoursPP`: `=IF(AND(PanelsPP>0, PanelsPT>0), Rate, "")`

**UH1:** Standard unit hours pattern
**GH1:** Standard group hours pattern

**Tag summaries:** Each tag formula sums from all 5 sub-blocks based on tag match:
```
P_LC103_TagBase_HoursPP = IF(TopTag="base", TopHours, "") + IF(HBTag="base", HBHours, "") + ... for all 5 sub-blocks
```

**LC total:**
```
P_LC103_HoursPP = if(SUM(GH1, UH1, Other, HB, Top) = 0, "", SUM(...))
LC103_TotalHours = SUM(all sub-block totals from column C)
P_LC103_HoursPT = HoursPP × Qty
```

#### LC104 CNC (Rows 817–851) — TIER 2 (1 Rate gated + 2 Unit + 2 Group)
- TopPanels: panel count + rate (similar to LC103 top panels)
- UH1, UH2 (two unit hour slots)
- GH1, GH2 (two group hour slots)
- Tag summaries, LC total

#### LC105 Wood Fab (Rows 852–886) — TIER 2 (1 Unit gated + 2 Unit + 2 Group)
- W1: Table-count based. `P_LC105_W1_Check` checkbox, `P_LC105_W1_HoursPP` (INPUT — direct hours per product)
- UH1, UH2
- GH1, GH2
- Tag summaries, LC total

#### LC106 Finish Sanding (Rows 887–917) — TIER 2 (2 Rate gated + 1 Unit + 1 Group)
- TopPanel: SqFt-based rate. `P_LC106_TopPanel_Check` is a **formula** (auto-derived), not a manual checkbox
- HBPanels: SqFt-based rate. `P_LC106_HBPanels_Check` is manual checkbox
- `LC106_TopPanel_Rate`, `LC106_HBPanels_Rate`: INPUT — sqft/hr
- UH1, GH1
- Tag summaries, LC total

> **Note:** LC106 is the only LC where the TopPanel check is a formula rather than a manual checkbox.

#### LC107 Metal Fab (Rows 917–967) — TIER 2 (3 Unit gated + 1 Unit + 1 Group)
- **Bases:** Piece-count based. `P_LC107_Bases_Check`, `P_LC107_Bases_UnitsPP` (formula from base count), `P_LC107_Bases_HoursPU` (INPUT)
- **Other1, Other2:** Manual piece-count entries. `P_LC107_OtherN_UnitsPP` (INPUT), `P_LC107_OtherN_HoursPU` (INPUT)
- `P_LC107_TotalPiecesPP`: Sum of all three piece sources
- UH1, GH1
- Tag summaries, LC total

#### LC108 Stone Fab (Rows 969–1016) — TIER 2 (2 Rate gated + 1 Unit + 1 Group)
- **Polishing:** `P_LC108_Polishing_Check`, SqFt-based rate, total units tracking
- **Terrazzo:** `P_LC108_Terrazzo_Check`, SqFt-based rate, separate from polishing
- Both calculate `TimePerSqFt` for analysis
- UH1, GH1
- Tag summaries, LC total

#### LC109 Finishing (Rows 1017–1072) — TIER 2 (2 Rate gated + 1 Unit + 1 Group)
- **Spray:** `P_LC109_Spray_Check` is a **formula** (auto-derived). SqFt-based rate
- **Stain:** `P_LC109_Stain_Check` is a manual checkbox. SqFt-based rate
- `P_LC109_StainSpray_HoursPP`: Combined spray + stain hours
- `LC109_SqFtRate`: Effective combined sqft/hr rate
- UH1, GH1
- Tag summaries, LC total

> **Note:** LC109's Spray check is auto-derived like LC106's TopPanel check.

#### LC110 Assembly (Rows 1073–1100) — TIER 2 (2 Unit + 2 Group)
- UH1, UH2 only (no rate-based sections)
- GH1, GH2
- Tag summaries, LC total

#### LC100 Material Handling (Rows 1101–1128) — TIER 2 (2 Unit + 2 Group)
- UH1, UH2 only (no rate-based sections)
- GH1, GH2
- Tag summaries, LC total

> **Note:** LC100 appears out of numeric order in the sheet (after LC110, before LC111). This is intentional — material handling is typically the first production step but was added to the sheet later.

#### LC111 Packing + Loading (Rows 1129–1156) — TIER 2 (2 Unit + 2 Group)
- UH1, UH2 only (no rate-based sections)
- GH1, GH2
- Tag summaries, LC total

### Hours Summary (Rows 1158–1179)

**Per-LC totals (Rows 1159–1170):** Column C sums from each LC's total row.

**Tag Summary (Rows 1172–1176):** *(verified — full cross-LC rollup)*
Each tag row sums that tag's hours across ALL 12 labor centers:
```
P_TagBase_HoursPP = SUM(LC111_TagBase, LC100_TagBase, LC110_TagBase, ..., LC101_TagBase, LC102_TagBase)
TagBase_TotalHours = same pattern in column C
```
- `P_TagGeneralTop_HoursPP`: `=TotalHours - SUM(Base, Feature1, Feature2)` — **calculated as remainder**, not directly tagged
- `P_TagBase_HoursPP`: Sum of Base-tagged hours from all LCs
- `P_TagFeature1_HoursPP`: Sum of Feature1-tagged hours from all LCs
- `P_TagFeature2_HoursPP`: Sum of Feature2-tagged hours from all LCs

> **Important:** LC101 and LC102 (Tier 1) don't have tag sub-blocks, but they do still contribute to the tag summary via their BasePP values feeding into the TagBase calculation.

**Grand totals:**
- **Row 1178: `P_HoursPP`** = Sum of all 12 labor centers' HoursPP
- `TotalHours`: `=SUM(rows 1160:1171)` — column C sum of per-LC totals
- Row 1179: `P_HoursPT` = `HoursPP × Quantity`
- `TotalHours_ValueCheck`: Cross-check (SUM of all PT values)

---

## SECTION 4: FINAL PRICING (Rows 1181–1355)

### Margin Adjustment (Rows 1183–1266)
Each material cost category gets its own margin rate. Pattern for each:
```
Cost PP (pulled from Section 2)
Total Cost = CostPP × Quantity
Final Cost = CostPP × (1 + MarginRate)
Total Final = FinalCost × Quantity
Margin PP = FinalCost - CostPP
Total Margin = MarginPP × Quantity
```

| Category | Source Row | Margin Rate RowKey | Default Rate |
|----------|-----------|-------------------|--------------|
| Hardwood (Top Only) | 517-518 | P_Hardwood_MarginRate | 5% |
| Stone | 543 | P_Stone_MarginRate | 25% |
| Stock Base | 565 | P_StockBase_MarginRate | 25% |
| Stock Base Shipping | 570 | P_StockBaseShipping_MarginRate | 5% |
| Powder Coating 1 | 573 | P_PowderCoat1_MarginRate | 10% |
| Custom/Other Base | calculated | P_CustomBaseCost_MarginRate | 5% |
| Unit Costs | 684 | P_UnitCost_MarginRate | 5% |
| Group Costs | 717 | P_GroupCost_MarginRate | 5% |
| Misc | 721 | P_Misc_MarginRate | 0% |
| Consumables | 725 | P_Consumables_MarginRate | 0% |

**Custom/Other Base Cost (Row 1225):** Special aggregation = `GCB + UCB + PowderCoat2 + HardwoodBaseCost`
This is where `P_BaseAndHB_CostPP` comes in — it aggregates all base-related costs that aren't stock base or powder coat 1.

### Price Assembly (Rows 1265–1283)

```
Row 1265: P_Adjustment_MaterialMarginPP = SUM(all 10 category final costs) - TotalCost
          [The total margin dollars added across all categories]
Row 1267: Total Cost Per Table    = SUM of all 10 category costs [feeds from each category's cost row]
Row 1268: P_MarginRate            = Adjustment / Cost  (blended effective rate — FORMULA, not input)
Row 1269: P_Material_Price        = TotalCost × (1 + MarginRate)  [Material price with margin baked in]
Row 1271: Hours Per Table         = P_HoursPP (from row 1178)
Row 1272: P_HourlyRate            = INPUT (e.g., $155/hr)
Row 1273: P_Hours_Price           = Hours × HourlyRate
Row 1275: P_Price                 = Material Price + Hours Price
Row 1276: P_FinalAdjustmentRate   = INPUT (multiplier, default 1.0)
Row 1278: P_FinalPrice            = Price × Adjustment
Row 1279: P_FinalPrice_Rep        = FinalPrice × (1 + RepRate)  [from MASTER!$F$2]
Row 1280: P_FinalPriceTotal       = FinalPrice × Quantity
Row 1281: P_FinalPriceTotal_Rep   = FinalPrice_Rep × Quantity
Row 1283: P_SalePrice             = IF(Rep="Yes", FinalPrice_Rep, FinalPrice) rounded
Row 1284: P_SalePriceTotal        = SalePrice × Quantity
```

**Job-level totals (column C):**
- `FinalPriceTotal_NoRep`: `=SUM(E1280:V1280)`
- `FinalPriceTotal_Rep`: `=SUM(E1281:V1281)`
- `FinalPriceTotal`: `=SUM(E1284:V1284)` — this is the actual quoted total

### Dual-Track Analysis (Rows 1296–1316) *(verified)*

Two parallel analysis tracks showing pricing metrics before and after the Final Adjustment Rate:

**Track 1 — As-Calculated (rows ~1300–1308):**
```
P_Hours_PriceTotal      = P_HoursPT × HourlyRate          [hours cost before adjustment]
TotalHoursPrice_1       = SUM across products
Shop_HourlyRate_1       = TotalHoursPrice / TotalHours     [effective rate]
P_MaterialMarginPP      = MaterialPrice - TotalCost        [margin dollars PP]
P_MaterialMarginPT      = MarginPP × Qty
TotalMaterialMargin_1   = SUM across products
Total_MaterialCost_MaterialMargin_1 = MaterialCost + MaterialMargin
```

**Track 2 — After Adjustment (rows ~1311–1316):**
```
P_Hours_PriceTotal_Adjusted     = HoursPriceTotal × FinalAdjustmentRate
TotalHoursPrice_Adjusted        = SUM across products
Shop_HourlyRate_Adjusted        = AdjustedHoursPrice / TotalHours    [shows adjustment impact on effective rate]
P_Material_Price_Adjusted       = MaterialPrice × FinalAdjustmentRate
P_MaterialMarginPP_Adjusted     = AdjustedMaterialPrice - TotalCost
P_MaterialMarginPT_Adjusted     = AdjustedMarginPP × Qty
TotalMaterialMargin_Adjusted    = SUM across products
```

### Job Summary (Rows 1318–1328)
Aggregates across all products for the job-level view:

| Field | Source | Type |
|-------|--------|------|
| `Shipping` | INPUT | Manual entry |
| `RepCommission` | `=if(Rep="yes", RepTotal - NoRepTotal, "")` | Formula |
| `BudgetBufferRate` | INPUT | Percentage |
| `MaterialBudget` | Formula | Budget allowance |
| `SalesTax` | `='Quote 1'!K180` | From Quote sheet |
| `SalesTaxRate` | `='Quote 1'!J180` | From Quote sheet |
| `TotalCost` | `=SUM(Shipping, Commission, Tax, Buffer)` | Formula |
| `TotalRev` | `=Q_TotalFinal` | From Quote sheet |
| `OpRev` | `=TotalRev - TotalCost` | Formula |
| `TotalHourlyRate` | `=OpRev / TotalHours` | Effective job-level hourly rate |

---

## SECTION 5: REFERENCE / LOOKUP / DESCRIPTION ENGINE (Rows 1371–1595)

> **Row number note:** This section was cleaned up in February 2025, removing ~91 rows of dead/broken content. All row numbers below reflect the **cleaned file** (V5_Master_Quote_Sheet_Feb_2025_placeholder_Data.xlsx, 1,595 rows). The old 1,682-row file had everything shifted +9 to +52 rows higher depending on position.

### 5.1 Pricing Validation (Rows 1372–1373)
- Row 1373: `=if(E1266=E729,0,1)+IF(E1266=0,1,0)` — checks that total cost at row 1266 matches the cost rollup at row 729. Returns 1 on mismatch. Drives **conditional formatting** on row 1266 (red highlight when cost integrity fails).

### 5.2 Old Pricing Calculator (Rows 1387–1396) — MANUAL REFERENCE

⚠️ **Not orphaned — intentionally kept as a sanity-check tool.** Colin uses this to see what the old quote sheet would have priced a hardwood table at, as a second opinion when fine-tuning final pricing.

| Row | Label | Formula |
|-----|-------|---------|
| 1387 | Old Hardwood Top Pricing | XLOOKUP to Inputs sheet species pricing |
| 1388 | lookup | `=E1416` (current species key) |
| 1391 | Base Cost + 30% | `=E1258*1.3` |
| 1393 | Per Table rough old price | `=SUM(E1387+E1391)` |
| 1394 | Rep | `=E1393*1.08` |
| 1395 | Total rough old price | `=E1393*E$39` |
| 1396 | Rep | `=E1394*E$39` |

Note: Uses 1.2× waste factor (outdated — current system uses 1.3×). No downstream references — purely visual.

### 5.3 Lumber Thickness Lookup Table (Rows 1401–1410)

Maps user-entered thickness strings to raw lumber dimensions and quarter codes:

| Row | A (Finished) | B (Raw Decimal) | C (Quarter Code) |
|-----|-------------|-----------------|------------------|
| 1404 | 1" | 1.0 | 4/4 |
| 1405 | 1.25" | 1.5 | 6/4 |
| 1406 | 1.5" | 2.0 | 8/4 |
| 1407 | 1.75" | 2.0 | 8/4 |
| 1408 | 2" | 2.0 | 8/4 |
| 1409 | 2.25" | 2.5 | 10/4 |
| 1410 | 2.5" | 2.5 | 10/4 |

> **xlsx display note:** Column C values display as dates in Excel/openpyxl (4/4 → "April 4") but render correctly in Google Sheets via `getDisplayValue()`. Formulas reference column B (raw decimal) for calculations, so this is cosmetic only.

Two XLOOKUPs reference this table:
- Row 1414: `=XLOOKUP(E1413, $A$1404:$A$1410, $B$...)` → raw thickness (e.g., 1.5) → feeds row 53 for BdFt calculation (19 upstream refs)
- Row 1415: `=XLOOKUP(E1413, ..., $C$...)` → quarter code (e.g., "6/4") → feeds row 1416 for key generation

### 5.4 Species Key Generation (Rows 1411–1437) — CRITICAL PATH

Generates unique species+thickness keys that drive the entire hardwood pricing system. Five parallel key chains (top + 4 HWB base components):

**Top Key Chain (rows 1411–1416):**

| Row | Label | Formula | Output (Product E example) |
|-----|-------|---------|---------------------------|
| 1411 | table top material | `=if(or(E47="Hardwood",E47="Live Edge"),E72,"")` | "Red Oak" |
| 1412 | (validated species) | `=IF(COUNTIF($A$1457:$A$1470,E1411)>0, E1411, "")` | "Red Oak" |
| 1413 | thickness | `=if(E1411<>"",E48,"")` | '1.25"' |
| 1414 | (raw thickness) | `=XLOOKUP(E1413, thickness_table_A, thickness_table_B)` | 1.5 |
| 1415 | (shorthand code) | `=XLOOKUP(E1413, thickness_table_A, thickness_table_C)` | "6/4" |
| 1416 | **Top Key** | `=JOIN(" ", E1412, E1415)` [Google Sheets] | **"Red Oak 6/4"** |

**Critical downstream connections from Top Key (row 1416):**
- → Row 361 (species distribution material key) — 38+ upstream refs across all product columns
- → Row 1439 (legend display)
- → Row 1388 (old pricing calculator)

**HWB Base Component Key Chains (rows 1418–1437):**
Same pattern as top key, but sources species from HWB Builder inputs instead of row 72:

| Component | Species Source | Key Output Row | Feeds Rows |
|-----------|--------------|----------------|------------|
| Plank | Row 138 (`=E138`) at R1419 | R1422 | 141 (material key), 365 (species dist) |
| Leg/Beam | Row 155 (`=E155`) at R1424 | R1427 | 158 (material key), 369 (species dist) |
| Apron Length | Row 173 (`=E173`) at R1429 | R1432 | 177 (material key), 373 (species dist) |
| Apron Width | Row 191 (`=E191`) at R1434 | R1437 | 195 (material key), 377 (species dist) |

Each component key has the same three-step chain: species → thickness → `JOIN(species, code)`.

### 5.5 Legend & Unique Species List (Rows 1439–1452) — CRITICAL PATH

**Legend (rows 1439–1443):**
Rows 1439–1443 mirror all 5 component keys (top, plank, leg, apronL, apronW) per product column. This creates a 5-row × 18-column matrix of all species keys in the job.

**Unique Species Deduplication (rows 1445–1452):**
Row 1445 B column contains the master deduplication formula:
```
=UNIQUE(FILTER(FLATTEN(E1439:V1443), FLATTEN(E1439:V1443)<>""))
```
This flattens all 5×18 = 90 key cells, filters blanks, and produces up to 8 unique species+thickness combinations. Results spill into B1445:B1452.

These unique species names are the source for:
- XLOOKUP at B381–B430 (species distribution block names)
- XLOOKUP at B438–B504 (species pricing block names)

### 5.6 Master Species Validation List (Rows 1457–1470)

14 valid species names used by COUNTIF at row 1412 to validate species input:

Ash, Red Oak, Walnut, White Oak, Maple, Mahogany, Teak, Thermally Modified Ash, Mesquite, Walnut Live Edge, Maple Live Edge, White Oak Live Edge, Solid Hardwood Live Edge, Live Edge Slab

### 5.7 Conditional Formatting Helpers (Rows 1474–1477, 1491–1492, 1513–1514, 1535–1536, 1542–1548)

Helper formulas that drive conditional formatting rules on the spec/description rows. These are scattered across the reference section but documented together since they form a cohesive validation system.

| Helper Row | Formula | CF Target | Highlight Condition |
|------------|---------|-----------|---------------------|
| 1491 | `=--ISNUMBER(SEARCH("Stone",E$47))` | Row 74 (Stain/Color) | 0 → hide (stone products don't use stain) |
| 1492 | `=IF(E74<>"",1,0)` | Row 74 | 0 → gray out when no color entered |
| 1491 | (same stone flag) | Row 74 | 1 → yellow highlight (stone with color) |
| 1513 | `=--ISNUMBER(SEARCH("Stone",E$47))` | Row 87 | Auto-populates "3/4 Plywood Substrate" text |
| 1514 | `=IF(AND(or(HW,LE),E90=""),1,0)` | Row 90 | Red when hardwood/LE but grain direction empty |
| 1535 | `=COUNTA(E95:E101)` | Row 94 | Red if Stock Base + no SB fields filled; Yellow if Custom Base + SB fields have data |
| 1536 | `=COUNTA(E103:E109)` | Rows 102, 110, 117 | Red if Custom Base + no CB fields; Yellow if Stock Base + CB data |
| 1542 | `=IF(E43="custom height",1,0)+(IF(E44<>"",1,0))` | Row 44 | Red when "custom height" selected but no value entered |
| 1543 | `=IF(E45="custom shape",1,0)+(IF(E46<>"",1,0))` | Row 46 | Red when "custom shape" selected but no value entered |
| 1545 | `=IF(OR(E47="Hardwood",E47="Live Edge"),1,0)+(IF(E48<>"",1,0))` | Row 48 | Red when hardwood/LE but no lumber thickness |
| 1546 | `=IF(OR(E47="Hardwood",E47="Live Edge"),1,0)+(IF(E48=E80,1,0))` | Row 80 | Red when lumber thickness ≠ edge thickness |
| 1373 | `=if(E1266=E729,0,1)+IF(E1266=0,1,0)` | Row 1266 | Red on cost integrity mismatch |

**Validation logic:** Most of these use a "sum of conditions" pattern where result=1 means exactly one condition is true (problem state). When both conditions are true (result=2) or both false (result=0), the field is valid. The CF rules test for `=1` to flag incomplete pairs.

Rows 1547–1548 are thickness comparison mirrors: `R1547=E48`, `R1548=E80` — these support the row 80 CF validation by providing the two values side-by-side in the reference section.

### 5.8 Description Autofill Engine (Rows 1481–1536) — CRITICAL PATH

Builds the six customer-facing description lines at rows 32–38. Uses Google Sheets native `JOIN()` and `FILTER()` functions wrapped in `IFERROR(__xludf.DUMMYFUNCTION("formula"), cached_fallback)` for xlsx compatibility.

**Core pattern:** Each description line is built by:
1. Collecting relevant field values into staging rows
2. Joining non-empty values with `JOIN(" - ", FILTER(range, LEN(range)))` separator
3. Routing to the correct output row

#### 5.8.1 Top Material + Finish → Row 34

**Hardwood path (rows 1483–1490):**
| Row | Source | Example |
|-----|--------|---------|
| 1483 | `=JOIN(" ", "Solid", E72)` | "Solid Red Oak" |
| 1484 | `=E73` (style) | "Mixed Plank" |
| 1485 | `=IF(E74="stain", JOIN(": ",E74:E75), E74)` | "Natural Color" or "Stain: Early American" |
| 1486 | `=IF(E74="stain","",E75)` (color if not stain) | "" or "Valor White" |
| 1487 | `=E76` (sheen) | "Matte" |
| 1488 | `=E77` (custom finish 1) | "" |
| 1489 | `=E78` (custom finish 2) | "" |
| **1490** | `=JOIN(" - ", FILTER(1483:1489, LEN(...)))` | **"Solid Red Oak - Mixed Plank - Natural Color - Matte"** |

**Non-hardwood path (row 1494):**
`=iferror(JOIN(" - ", FILTER(E72:E78, LEN(E72:E78))), "")`
Joins rows 72–78 directly (no "Solid" prefix, no stain logic).

**Router (row 1495):**
`=IF(E47="Hardwood", E1490, E1494)` → **row 34**

The hardwood path adds "Solid" prefix and handles the stain/color split logic. Non-hardwood (stone, laminate, etc.) joins the raw field values directly. Note: "Live Edge" uses the non-hardwood path (no "Solid" prefix).

#### 5.8.2 Top Edge → Row 35

| Row | Formula | Purpose |
|-----|---------|---------|
| 1497 | `=IF(E81="Metal Edge Band","Edge Detail:","Edge Profile:")` | Label switches based on edge type |
| 1498 | (static: "Top Thickness:") | |
| 1499 | `=JOIN(" ", E1498, E80)` | "Top Thickness: 1.25"" |
| 1500 | `=JOIN(" ", E1497, E81)` | "Edge Profile: Eased Edge" or "Edge Detail: Metal Edge Band" |
| 1501 | `=E82` (custom edge 1) | |
| 1502 | `=E83` (custom edge 2) | |
| **1503** | `=JOIN(" - ", FILTER(1499:1502, LEN(...)))` | **→ row 35** |

#### 5.8.3 Top Details → Row 36

| Row | Formula | Purpose |
|-----|---------|---------|
| 1505–1506 | `=E85`, `=E86` | Custom detail descriptions |
| 1507 | `=E87` | Auto-populate stone substrate |
| 1508 | `=E88` | Auto-populate hardwood protective finish |
| 1509 | `=IF(or(HW,LE), JOIN(" ",E89:E90), "")` | Grain direction string (HW/LE only) |
| **1510** | `=iferror(JOIN(" - ", FILTER(1505:1509, LEN(...))), "")` | Joined details |
| 1511 | `=JOIN("", "*", E91)` | Special note with asterisk prefix |
| **1512** | `=IF(E91<>"", JOIN(newline, E1510, E1511), E1510)` | **→ row 36** (adds special note on separate line) |

#### 5.8.4 Base Description → Row 37

Three routing paths controlled by row 49 (Base Type):

- **"Top Only":** Row 37 formula returns `"Table Top Only"`
- **Stock Base** (rows 1518–1525):
  - Rows 1518–1524 mirror: row 93 (height), 96 (outdoor), 97 (type), 98 (style), 99 (plate size), 100 (column), 101 (top plate)
  - Row 1525: `=iferror(JOIN(" - ", FILTER(1518:1524, LEN(...))), "")`
- **Custom Base** (row 1527):
  - `=if(countA(E103:E109)=0, "", JOIN(" - ", FILTER(E103:E109, LEN(...))))` — joins non-empty custom base fields

#### 5.8.5 Base Finish → Row 38

| Row | Formula | Purpose |
|-----|---------|---------|
| 1528 | `=if(countA(E111:E116)=0, "", JOIN(...))` | Finish material + type + color |
| 1529 | `=if(E118<>"", JOIN(" ","Feet:",E118), "")` | "Feet: Adjustable Glides" |
| 1530 | `=IF(E50>1, JOIN(" ",E50,"Bases Per Top"), "")` | "2 Bases Per Top" (only if >1) |
| 1531 | `=IF(E119<>"", JOIN("","*",E119), "")` | Special base note with asterisk |
| 1532 | `=JOIN(" - ", FILTER(1528:1530, LEN(...)))` | Main finish line |
| 1533 | `=JOIN(newline, E1532, E1531)` | With special note on new line |
| **1534** | `=iferror(IF(E119<>"", E1533, E1532), "")` | **→ row 38** (include note line only if present) |

CF helpers for base section:
- Row 1535: `=COUNTA(E95:E101)` — stock base field count → CF on row 94
- Row 1536: `=COUNTA(E103:E109)` — custom base field count → CF on rows 102, 110, 117

### 5.9 Dimension Engine (Rows 1538–1544) — CRITICAL PATH

Builds the dimension string at row 32 (Overall Dimensions):

| Row | Label | Formula | Output Examples |
|-----|-------|---------|-----------------|
| 1539 | Dia condition | `=IF(E45="DIA", JOIN(" ",E41,E45), JOIN(" x ",E41,E42))` | '36" x 36"' or '30" DIA' |
| 1540 | Height Condition | `=IF(E43="custom height", JOIN(" x ",E1539,JOIN("H",E44,"")), JOIN(" - ",E1539,E43))` | '36" x 36" - Bar Height' or '36" x 36" x 38"H' |
| 1541 | Custom Shape | `=if(E45="custom shape", JOIN(" - ",E1540,E46), "")` | '36" x 36" - Bar Height - Half Pill' |
| 1544 | Hours Detail Dim | `=if(E46<>"", JOIN(" - ",E1539,E46), E1539)` | Dimensions for hours detail (no height) |

Row 32 formula: `=IF(E1541<>"", JOIN(E1540, E1541), E1540)` — uses custom shape version if present, otherwise standard.

### 5.10 Dynamic Dropdown Lookups (Rows 1550–1570) — CRITICAL PATH

**The most architecturally interesting feature in the reference section.** These are context-sensitive dropdown lists — the available options change based on the product's material type.

#### 5.10.1 Material Dropdown (Row 1552) → DV at Row 72

**Formula:** `=CHOOSECOLS(Inputs!$A$72:$E$80, MATCH(E47, Inputs!$A$71:$E$71, 0))`

This selects a **different column** from the Inputs sheet lookup table based on E47 (Material Type). The Inputs sheet is organized with material types as column headers:

| Inputs Row | A (Hardwood) | B (Stone 1) | C (Live Edge) | D (Laminate) | E (Outdoor) |
|-----------|-------------|-------------|---------------|-------------|-------------|
| 71 | Hardwood | Stone 1 | Live Edge | Laminate | outdoor |
| 72 | Ash | Quartz | Walnut Live Edge | Laminate | Acre |
| 73 | Red Oak | Terrazzo | Maple Live Edge | | Thermally Modified Ash |
| 74 | Walnut | Granite | White Oak Live Edge | | HPL |
| 75 | White Oak | Solid Surface | Solid Hardwood Live Edge | | |
| 76 | Maple | Travertine | Live Edge Slab | | |
| 77 | Mahogany | Marble - Natural | | | |
| 78 | | Sintered Stone | | | |
| 79 | | Porcelain | | | |

Each product column gets its own resolved dropdown list. When E47="Hardwood", column E shows Ash/Red Oak/Walnut/etc. When F47="Stone 1", column F shows Quartz/Terrazzo/Granite/etc.

**Data validation** at D72:V72 points to `'Pricing 1'!D1552:D1561` — the D column serves as the DV source range, and the formula populates E–V dynamically.

Row 1561 ("Custom Entry") provides a free-text option at the end of every material list.

#### 5.10.2 Style/Manufacturer Dropdown (Row 1563) → DV at Row 73

**Formula:** `=CHOOSECOLS(Inputs!$A$84:$E$90, MATCH(E47, Inputs!$A$83:$E$83, 0))`

Same CHOOSECOLS pattern. Inputs sheet style options by material type:

| A (Hardwood) | B (Stone 1) | C (Live Edge) | D (Laminate) |
|-------------|-------------|---------------|-------------|
| Mixed Plank | Daltile | Joined Slab | Wilsonart |
| Butcher Block | MSI | Full Slab | Formica |
| | Caesarstone | | Arborite |
| | Stratus | | |
| | Triton | | |
| | Cambria | | |
| | Dekton | | |
| | Silestone | | |

**Data validation** at D73:V73 points to `'Pricing 1'!D1563:D1570`.

#### 5.10.3 Unfinished Dropdown Expansions (Rows 1571–1584) — INCOMPLETE

Three additional dropdown sections exist as **empty placeholders**, intended to use the same CHOOSECOLS dynamic pattern but never completed:

| Row | Label | Status |
|-----|-------|--------|
| 1571 | Stain / Color | Empty — headers only, no CHOOSECOLS formula |
| 1576 | Color Name | Empty — headers only |
| 1584 | Sheen / Stone surface | Empty — headers only |

**Design intent:** These were supposed to provide context-sensitive dropdown options for stain/color (row 74), color name (row 75), and sheen/finish (row 76) — where the available options would change based on material type, similar to rows 1552 and 1563. For example, stone products might show "Polished / Honed / Leathered" while hardwood shows "Matte / Satin / Semi Gloss".

**Current state:** The DV at rows 74 and 76 uses inline validation lists (hardcoded in the DV rule itself, not referencing the reference section). This works but doesn't adapt per material type. Row 75 has no DV — it's free text.

**Kept intentionally** for future completion. No formulas to break, no downstream dependencies.

### 5.11 Google Sheets Native Functions

~30 formulas in the reference section use Google Sheets functions not available in Excel. In the xlsx export, these appear as:
```
=IFERROR(__xludf.DUMMYFUNCTION("original_formula"), cached_fallback)
```

Functions used:
- **JOIN(separator, values)** — String concatenation with separator
- **FILTER(range, condition)** — Array filtering
- **UNIQUE(array)** — Deduplication
- **FLATTEN(range)** — 2D array → 1D array
- **CHOOSECOLS(array, col_index)** — Dynamic column selection

The `cached_fallback` value is the last computed result before xlsx export. The original formula text is visible inside the DUMMYFUNCTION string and is what actually executes in Google Sheets.

---

## CROSS-SHEET DEPENDENCIES

### Quote 1 → Pricing 1
The Quote sheet is a read-only presentation layer. For each product (E through V):
- Title: `='Pricing 1'!E31`
- Dimension: `='Pricing 1'!E32`
- Table Top description: `='Pricing 1'!E34` through `E36`
- Table Base description: `='Pricing 1'!E37`, `E38`
- **Price Per Unit:** `='Pricing 1'!E1282` (P_SalePrice)
- **Quantity:** `='Pricing 1'!E39`
- **Line Total:** `=Price × Quantity`
- Shipping: `='Pricing 1'!C1318`
- Sales Tax: references J180 (rate) × subtotal
- **Grand Total:** `=SUM(all line totals + shipping + tax)`

### Pricing 1 → MASTER
- Row 2: Project Name (`=MASTER!B2`), Deal ID (`=MASTER!B3`)

### Pricing 1 → Inputs
- Species pricing references from Inputs sheet (lumber cost table, rows 9–22)
- Dynamic dropdown sources: Material options (Inputs rows 71–80), Style/Manufacturer options (Inputs rows 83–91)
- Old Pricing Calculator (row 1387): XLOOKUP to Inputs species pricing

### Pricing 1 ← Quote 1 (Circular)
- Row 1318: Shipping = `='Quote 1'!K174`
- Row 1321: Sales Tax = `='Quote 1'!K180`
- Row 1324: Final Quote Total = `='Quote 1'!K183`

---

## INTERVIEW QUESTIONS FOR DOMAIN KNOWLEDGE

### Priority 1: Remaining Gaps
1. **Tag system in practice:** What constitutes a "feature" vs base hours? Can you walk through a real example where Feature 1 and Feature 2 are used?

2. **Labor center rates:** The sqft/hr and panels/hr rates in column B — are these stable across jobs, or adjusted per job?

3. **LC106 auto-check / LC109 Spray auto-check:** What logic drives these formula-based checkboxes? When would they be FALSE?

4. **Multiple products in one quote:** In practice, how many of the 18 product columns do you typically use? Is it usually 1–3, or do you regularly fill 10+?

### Priority 2: Usage Patterns
5. **UC slots (1–9):** What are the most common things that go in here? Are certain slots conventionally used for certain items?

6. **Stone workflow:** 3 stone slots — what would use more than one? Different stone types on the same table?

7. **Metal base worksheet (rows 204–330):** How does the laser cutting data flow into costs? I see areas for 3 parts but no obvious cost formula connection to the UC/GC slots.

8. **Terrazzo vs regular stone:** What distinguishes these in practice?

9. **Consumables:** What typically goes here? Sandpaper, glue, etc.?

### Resolved Questions *(from registry analysis)*
- ~~Group Cost distribution type choice~~ → *(Answered §2 Domain Knowledge)*
- ~~Margin rate rationale~~ → *(Answered §6 Domain Knowledge)*
- ~~1.3 vs 1.25 waste factor~~ → *(Answered §3 Domain Knowledge — known discrepancy)*
- ~~Final Adjustment Rate usage~~ → *(Answered §6 Domain Knowledge)*
- ~~Rep commission flow~~ → *(Answered §6 Domain Knowledge)*
- ~~Stock Base vs Custom Base frequency~~ → *(Partially answered §4 Domain Knowledge)*
- ~~Tag system architecture~~ → *(Answered §5 Domain Knowledge — full rollup documented)*

### Resolved Questions *(from reference section deep-dive, Feb 23)*
- ~~Reference section row map~~ → *(Full rewrite of §5 with new row numbers)*
- ~~Description autofill engine~~ → *(Documented all 6 description chains in §5.8)*
- ~~Dynamic dropdown system~~ → *(Documented CHOOSECOLS pattern in §5.10)*
- ~~Species key generation chain~~ → *(Documented full trace in §5.4)*
- ~~Conditional formatting validation~~ → *(11 CF rules documented in §5.7)*
- ~~Old pricing calculator purpose~~ → *(Confirmed as manual reference tool in §5.2)*
- ~~Stain/Color/Sheen empty sections~~ → *(Confirmed unfinished DD expansions in §5.10.3)*
