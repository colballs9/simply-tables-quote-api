# Phase 1 Build Plan — Farmhouse Kitchen 0737

**Source:** `Copy_of_Farmhouse_Kitchen_0737_Quote_Sheet.xlsx`, Pricing 2 / Quote 2
**Target total:** $20,281.94 (before shipping) → $22,251.94 (with $1,970 shipping)
**Total hours:** 63.65

---

## Quote Profile

- **Project:** Farmhouse Kitchen
- **Deal ID:** 0737
- **Rep:** Yes — Jaysen Sanderson (Posh Hospitality) at **4%** (non-standard, default is 8%)
- **Hourly Rate:** $150 (not the default $155)
- **6 products, all Hardwood (Walnut 8/4 at $9.50/bd ft)**
- **5 with Stock Bases, 1 with Custom Base**
- **Shared costs:** Misc $500 (by sqft), Consumables $300 (by sqft), SB Shipping $25 (by units)
- **Non-default margin rates:** Hardwood 10%, Custom Base 10%, UC 10%, GC 10%

---

## The 6 Products

| # | Title | Qty | Width | Length | Shape | Base Type | Base Cost | BdFt | SqFt | Species Cost PP | Sale Price PP |
|---|-------|-----|-------|--------|-------|-----------|-----------|------|------|-----------------|---------------|
| 1 | Table 1 | 4 | 30 | 46 | Custom Shape (Booth Table) | Stock Base | $75 | 24.92 | 9.58 | $236.71 | $738.50 |
| 2 | Table 2 | 1 | 60 | 60 | DIA | Stock Base | $160 | 65.00 | 19.63* | $617.50 | $1,861.93 |
| 3 | Table 3 | 4 | 36 | 36 | Standard | Stock Base | $45 | 23.40 | 9.00 | $222.30 | $661.72 |
| 4 | Table 4 | 2 | 30 | 48 | Standard | Stock Base | $35 (×2 bases) | 26.00 | 10.00 | $247.00 | $759.81 |
| 5 | Table 5 | 20 | 27 | 30 | Standard | Stock Base | $40 | 14.63 | 5.63 | $138.94 | $436.63 |
| 6 | Table 6 | 1 | 36 | 60 | Standard | Custom Base | N/A | 39.00 | 15.00 | $410.08 | $2,566.91 |

*Table 2 SqFt uses DIA formula: 19.625 sq ft (not 25 sq ft from W×L)

Table 4 has **2 bases per top** at $35 each = $70 PP
Table 6 has **Custom Base** with 2 UC blocks: Power Unit ($200) + Shipping ($50) = $250

---

## Margin Rates (all products same)

| Category | Rate | Default |
|----------|------|---------|
| Hardwood | **10%** | 5% |
| Stone | 25% | 25% |
| Stock Base | 25% | 25% |
| SB Shipping | 5% | 5% |
| Powder Coat | 10% | 10% |
| Custom Base | **10%** | 5% |
| Unit Cost | **10%** | 5% |
| Group Cost | **10%** | 5% |
| Misc | 0% | 0% |
| Consumables | 0% | 0% |

**NOTE:** Stock Base margin is 25% on this quote (the default). The verification numbers ($385.98 material price PP, $738.50 sale price PP) confirm this.

---

## Shared Costs (Group Pools)

| Pool | Total | Distribution | Products |
|------|-------|-------------|----------|
| Stock Base Shipping | $25 | Units (all 33 bases) | Tables 1-5 (not Table 6) |
| Misc | $500 | Sq Ft | All 6 tables |
| Consumables | $300 | Sq Ft | All 6 tables |

**SB Shipping distribution:** $25 ÷ 33 units = $0.7576/unit. Every product gets $0.7576 PP regardless of size (since it's distributed by unit count × qty).

**Misc distribution example (Table 1):** Total sqft across all products = 246.83. Table 1 = 9.583 sqft × 4 qty = 38.33 sqft-units. Rate = $500 / 246.83 = $2.0257/sqft. CostPP = 38.33/4 × $2.0257 = $19.41.

---

## Labor Hours Summary

| LC | Total Hours | Products with hours |
|----|-------------|-------------------|
| LC100 Material Handling | 1.5 | All (GH block, distributed) |
| LC101 Processing | 17.14 | All (rate block, proportional by panel sqft) |
| LC102 Belt Sanding | 6.43 | All (rate block) |
| LC103 Cutting | 3.88 | All (rate block, top panels) |
| LC104 CNC | 1.00 | Table 6 only (rate block) |
| LC105 Wood Fab | 3.80 | Table 6 only (UH block: 3.5 hrs) |
| LC106 Finish Sanding | 20.91 | All (rate block) + Table 6 base panels |
| LC107 Metal Fab | — | None |
| LC108 Stone Fab | — | None |
| LC109 Finishing | 6.29 | All (rate block, spray) |
| LC110 Assembly | — | None |
| LC111 Packing | 2.70 | All (GH distributed) + Table 6 (UH: 0.7) |

**Per-product hours PP:**
- Table 1: 2.16h
- Table 2: 5.53h
- Table 3: 2.04h
- Table 4: 2.25h
- Table 5: 1.32h
- Table 6: 10.43h (much higher due to custom base work)

---

## Price Assembly Verification (Table 1)

```
Species Cost PP:     $236.71  (24.917 bdft × $9.50/bdft)
Stock Base PP:        $75.00  ($75 × 1 base)
SB Shipping PP:        $0.76  (group pool share)
Misc PP:              $19.41  (group pool share)
Consumables PP:       $11.65  (group pool share)
─────────────────────────────
Total Cost PP:       $343.53

Margin breakdown:
  Hardwood: $236.71 × 10% = $23.67
  Stock Base: $75.00 × 0% = $0.00
  SB Shipping: $0.76 × 5% = $0.04
  Misc: $19.41 × 0% = $0.00
  Consumables: $11.65 × 0% = $0.00
  Total margin: ≈ $42.46

Material Price PP:   $385.98  (cost + margin)
Hours Price PP:      $324.11  (2.161h × $150)
Price PP:            $710.09
Final Adjustment:    × 1.0
Final Price PP:      $710.09
With Rep (4%):       $738.50
× Qty 4:          $2,954.00
```

---

## What the App Needs to Handle This Quote

### CRITICAL — Must work for numbers to match:

1. **Species as a cost block with per_bdft multiplier** — The species cost ($9.50/bdft × bdft) must work as a cost block with `multiplier_type: "per_bdft"`. Currently the calc engine supports this.

2. **DIA sqft calculation** — Table 2 uses the circular area formula. The engine handles this. Verify the frontend passes shape="DIA" correctly and the computed sqft shows 19.625, not 25.

3. **Bases per top > 1** — Table 4 has 2 bases at $35 each. The stock base cost block needs `multiplier_type: "per_base"` and the product needs `bases_per_top: 2`. Verify this multiplies correctly.

4. **Group cost pools with sqft distribution** — Misc and Consumables distribute by sqft. The pool uses `sqft × qty` as the metric for each product. Verify the denominator sums correctly across all 6 products.

5. **Group cost pool with units distribution (SB Shipping)** — $25 across 33 total units (sum of all qty × bases_per_top). Only Tables 1-5 participate (not Table 6 which has custom base).

6. **Non-default margin rates** — Hardwood at 10% and Stock Base at 0% (both different from defaults). The product must store per-category margin rates and the engine must apply them.

7. **Non-default rep rate** — 4%, not 8%. The quote-level rep_rate field must propagate correctly.

8. **Non-default hourly rate** — $150, not $155. Per-product hourly_rate field.

9. **UC blocks only on specific products** — Table 6 has 2 UC blocks ($200 + $50), all others have none. This is the dynamic blocks concept working as designed.

10. **Rate-based labor blocks (LC101, LC102, LC103, LC106, LC109)** — These distribute hours proportionally by panel sqft across all products. The calc engine's rate block logic needs the `all_products_metric_total` parameter for cross-product distribution.

### IMPORTANT — UI must support:

11. **Custom Shape with description** — Table 1 is "Custom Shape" with "Booth Table" subtitle. Shape dropdown + conditional text field.

12. **6 active products, no limit** — Already designed this way.

13. **Mixed base types in one quote** — 5 stock base + 1 custom base. Products are independent.

14. **Group pool member selection** — SB Shipping includes only Tables 1-5. The UI needs checkboxes or selection for which products participate in each pool.

15. **Per-product margin rate editing** — Currently margin rates live on each product. The UI needs a way to set them (probably in an expandable "Margin Rates" section per product, or set at quote level and override per product).

16. **Quote-level shipping** — $1,970 shipping is added at the quote level, outside the per-product pricing. This needs a quote-level field (not in schema yet — simple addition).

### NICE TO HAVE for Phase 1:

17. **Description autofill** — "Solid Walnut - Mixed Plank - Natural Color - Matte" is generated from the description fields. The app has the description fields but no autofill engine yet.

18. **Base description from stock base fields** — "Dining Height - Cantilever Base - Large" is generated from the stock base description fields. Not critical for number matching.

---

## Known Gaps in Current App vs This Quote

| Gap | Severity | Where to fix |
|-----|----------|-------------|
| Rate-based labor blocks need cross-product metric total | HIGH | `compute_labor_block()` — already has the parameter, but `quote_service.py` may not be passing it |
| Margin rates save/load correctly through router → engine | ✅ DONE | All 10 margin rate fields persist via PATCH and are returned in ProductRead |
| Group pool sqft distribution uses sqft × qty, verify denominator | ✅ DONE | Fixed DIA sqft bug — pools now use sq_ft_wl (W×L) not DIA-adjusted sq_ft |
| Rep rate at 4% — verify non-default propagates | MEDIUM | `quote_service.py` → calc engine quote dict |
| Quote-level shipping field not in schema | ✅ DONE | Added `shipping` + `grand_total` to quotes (migration 002, model, schema, engine) |
| LC hours at rate level need all products' panel sqft to distribute | HIGH | Need to aggregate panel sqft across products before computing rate blocks |
| Material context should set correct default margins for Hardwood jobs | LOW | `material_context` seed data |
| Description autofill engine | LOW | Phase 2 |

---

## Recommended Build Order for Claude Code

1. **Fix rate-based labor block distribution** — This is the hardest calculation. Rate blocks (LC101, LC102, LC103, LC106, LC109) need total panel sqft across ALL products to distribute proportionally. The engine has the parameter but the service may not be collecting and passing it.

2. **Verify group pool sqft distribution** — Enter the Misc pool ($500, sqft, all 6 products) and confirm the per-product shares match the sheet.

3. **Verify margin rate persistence** — Set Hardwood to 10% and Stock Base to 0%, save, reload, confirm they stuck and the calc engine uses them.

4. **Add quote-level shipping** — Simple field addition. `ALTER TABLE quotes ADD COLUMN shipping NUMERIC(12,2) DEFAULT 0;`

5. **Test the full quote** — Enter all 6 products, all cost blocks, all group pools, all labor entries. Compare final per-product prices and total against the sheet.

6. **Fix whatever doesn't match** — This will surface the remaining bugs in the service layer (the layers between DB and engine that we identified as untested).
