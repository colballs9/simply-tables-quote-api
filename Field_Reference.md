# Field Reference â€” V5 Pricing Sheet Input Fields

**Living Document â€” Updated as new context is gathered**
**Last Updated: March 17, 2026**

---

## HOW TO USE THIS DOCUMENT

This documents every **input field** (white cell) in the Pricing sheet â€” what it means, what values it accepts, and how it affects downstream calculations. Fields are grouped by section. Formula-only fields are excluded unless they need explanation for context.

> **Convention:** Fields marked *(verified)* have been confirmed through voice interview or real-world testing. Fields marked *(from crawl)* are inferred from formula analysis only and may need clarification.
>
> Fields with **âœ… Data Validation** have dropdown lists in the sheet. The exact values are listed. Off-list values are allowed (validation is not enforced) but the list values should be preferred.

---

## PRODUCT CONFIGURATION (Rows 31â€“50)

| RowKey | Label | Type | Values / Range | Downstream Effect |
|--------|-------|------|---------------|-------------------|
| P_Title | Title | Text | Free text | Display only â€” shows on Quote sheet |
| P_Quantity | QUANTITY | Number | 1+ | **Master multiplier.** Nearly every total row = PP Ã— Quantity |
| P_Width | Width | Number (inches) | Typical: 12â€“60 | Drives SqFt, BdFt, dimension descriptions |
| P_Length | Length - Grain Direction | Number (inches) | Typical: 24â€“120 | Drives SqFt, BdFt, dimension descriptions |
| P_HeightName | Height | âœ… Dropdown | **"Dining Height" / "Counter Height" / "Bar Height" / "Top Only" / "Custom Height"** | Display + validation. "Custom Height" triggers P_HeightInput. Always set â€” even for Top Only base type. *(verified)* |
| P_HeightInput | Enter Custom Height | Text or Number | Any (e.g., 29 or "Tea Height") | Only used when HeightName = "Custom Height" *(verified)* |
| P_Shape | Shape | âœ… Dropdown | **"Standard" / "DIA" / "Custom Shape" / "Base Only"** | DIA triggers circular SqFt calc. Custom Shape triggers P_ShapeCustom |
| P_ShapeCustom | Shape - Custom Description | Text | Free text | Display only (e.g., "Half Pill", "4\" radius corners") |
| P_MaterialType | Product / Material | âœ… Dropdown | **"Hardwood" / "Stone 1" / "Stone 2" / "Stone 3" / "Live Edge" / "Laminate" / "Wood Edge Laminate" / "Outdoor" / "Other"** (Col D also has "Base Only") | **Major branch point.** Determines which cost sections activate. âš ï¸ Use "Stone 1" not "Stone". *(verified)* |
| P_LumberThickness | Hardwood Material (For Cost) | âœ… Dropdown | **'1.25"' / '1.75"' / '2.25"' / '1.5"' / '1"' / '.75"'** | Drives XLOOKUP for raw thickness â†’ BdFt calculation. Hardwood + Live Edge only. |
| P_BaseType | Base | âœ… Dropdown | **"Stock Base" / "Custom Base" / "Top Only"** | Determines which base cost/description sections activate. âš ï¸ Use "Custom Base" not "Custom". *(verified)* |
| P_BaseQtyPP | Bases Per Top | Number | Typically 1â€“4 | Multiplier for all per-base costs (stock base, UCB, powder coat) |

---

## TABLE TOP DESCRIPTION (Rows 69â€“90)

All display/description fields that feed the Quote sheet. No calculation impact.

### Material & Style (Rows 71â€“72)
| RowKey | Label | Type | Notes |
|--------|-------|------|-------|
| P_MaterialTop | Material | Text/Dropdown | **Dynamic dropdown** -- options change based on P_MaterialType via CHOOSECOLS at reference rows 1552â€“1561. Hardwood: Ash/Red Oak/Walnut/White Oak/Maple/Mahogany. Stone: Quartz/Terrazzo/Granite/etc. See Formula Map S5.10. |
| P_Desc_StyleORManufacturer | Style / Manufacturer | Text/Dropdown | **Dynamic dropdown** -- options change based on P_MaterialType via CHOOSECOLS at reference rows 1563â€“1570. Hardwood: Mixed Plank/Butcher Block. Stone: vendor names (Daltile, MSI, Caesarstone...). See Formula Map S5.10. |

### Stain / Color / Finish (Rows 73â€“77)

âš ï¸ **CRITICAL â€” Two separate fields for color:**

| RowKey | Label | Type | âœ… Valid Values | Notes |
|--------|-------|------|----------------|-------|
| P_Desc_StainORColor | Stain / Color | âœ… Dropdown | **"Natural Color" / "Stain" / "Dye" / "Custom Print"** | This is a **CATEGORY selector**, not the actual color. For hardwood stains: "Stain". For natural finish: "Natural Color". For stone: **leave EMPTY**. *(verified)* |
| P_Desc_ColorName | Color Name | Text | Free text | The **ACTUAL color name** goes here. e.g., "Black", "Lunar", "Early American". Used for ALL material types. *(verified)* |
| P_Desc_SheenORFinish | Sheen / Stone surface | âœ… Dropdown | **"Matte" / "Satin" / "Semi Gloss" / "Gloss" / "Polished" / "Leathered" / "Honed" / "Embossed"** | âš ï¸ No hyphen â€” "Semi Gloss" not "Semi-Gloss". For stone, ask as "stone finish" not "sheen". *(verified)* |
| P_Desc_FinishCustom1 | Custom Description Finish | Text | Free text line 1 | |
| P_Desc_FinishCustom2 | Custom Description Finish | Text | Free text line 2 | |

### Edge & Thickness (Rows 78â€“82)
| RowKey | Label | Type | âœ… Valid Values | Notes |
|--------|-------|------|----------------|-------|
| P_Desc_Thickness | Top Thickness - Description | âœ… Dropdown | **'1.25"' / '1.75"' / '2.25"' / '2 cm' / '3 cm' / '4cm mitered edge' / '.75"' / '7/8"' / '1.125"' / '1"' / '.8 cm' / '1.2 cm' / '1.5"'** | Auto-fills from P_LumberThickness for hardwood. âš ï¸ Must be set explicitly for stone (e.g., "2 cm"). *(verified)* |
| P_Desc_EdgeProfile | Edge Profile | âœ… Dropdown | **"Eased Edge" / "Reverse Chamfer" / "Reverse Knife Edge" / "Bullnose" / "Ogee" / "Custom Edge Profile" / "Metal Edge Band"** | âš ï¸ "Eased Edge" not "Eased". "Reverse Knife Edge" not "Knife Edge". *(verified)* |
| P_Desc_EdgeCustom1 | Custom Description Edge | Text | Free text line 1 | |
| P_Desc_EdgeCustom2 | Custom Description Edge | Text | Free text line 2 | |

### Details & Grain (Rows 83â€“90)
| RowKey | Label | Type | âœ… Valid Values | Notes |
|--------|-------|------|----------------|-------|
| P_Desc_Custom1 | Custom Description Details | Text | Free text | Extras/add-ons |
| P_Desc_Custom2 | Custom Description Details | Text | Free text line 2 | |
| P_Desc_GrainDirection | Grain Direction | âœ… Dropdown | **"Length" / "Width" / "N/A"** | Hardwood / Live Edge only |
| P_Desc_GrainDirectionPrefix | (auto-set) | Text | "Grain Direction:" | Set automatically whenever P_Desc_GrainDirection has a value |
| P_Desc_SpecialNote | Special Note for Top | Text | Free text | Warning/note text |

---

## BASE DESCRIPTION (Rows 91â€“118)

### Height (Row 92)
| RowKey | Label | Type | Notes |
|--------|-------|------|-------|
| (Row 92 mirrors P_HeightName) | Height | âœ… Dropdown | Same validation as P_HeightName above. Set via the Specs section. |

### Stock Base Fields (Rows 93â€“100)
| RowKey | Label | Type | âœ… Valid Values | Notes |
|--------|-------|------|----------------|-------|
| P_Desc_BS_Vendor | Company | âœ… Dropdown | **"JI Bases" / "No Rock" / "BFM" / "Tablebases.com" / "Peter Meier"** | PMI is commonly used but is off-list â€” enter as free text. |
| P_Desc_BS_Outdoor | Outdoor | âœ… Dropdown | **"Outoor"** | Note: typo in sheet is intentional. Or leave blank for indoor. |
| P_Desc_BS_Type | Type | âœ… Dropdown | **"Cast Iron Base" / "Bolt Down Base" / "Stainless Steel Base" / "Cantilever Base" / "Flat Metal Base" / "Stamped X Base" / "Self Stabilizing Base" / "Jaxon Base"** | Off-list values allowed. |
| P_Desc_BS_Style | Base Plate / Style | âœ… Dropdown | **"X Base" / "Round" / "T Base" / "3 Prong" / "Decorative" / "4 Post" / "Square" / "T Base Set"** | |
| P_Desc_BS_PlateSize | Base Plate Size | âœ… Dropdown | **'18" DIA' / '22" DIA' / '28" DIA' / '20" DIA' / '24" DIA' / '30" DIA' / '17" DIA' / '21" DIA'** + non-DIA sizes: '22"', '27"', '22" x 30"', '30"', '36"', '5" x 22"', '4" x 24"', '18"', '20"', '24"' | |
| P_Desc_BS_ColumnSize | Column (JI Only) | âœ… Dropdown | **'3"' / '4"' / '3" + Footring' / '4" + Footring' / '5"'** | JI Bases only |
| P_Desc_BS_TopPlateSize | Top Plate (JI Only) | âœ… Dropdown | **'13"' / '17"' / '24"'** | JI Bases only |

### Custom Base Fields (Rows 101â€“108)
| RowKey | Label | Type | âœ… Valid Values | Notes |
|--------|-------|------|----------------|-------|
| P_Desc_BC_MaterialType | Material | âœ… Dropdown | **"Hardwood + Metal" / "Hardwood" / "Metal"** | âš ï¸ Use "Metal" not "Steel" or "Iron" *(verified)* |
| P_Desc_BC_Style | Style | âœ… Dropdown | **"Pedestal Base" / "4 Leg Base" / "Cone Shape Base" / "Cylinder Base" / "Panel Base" / '"U" Shape Base' / '"A" Shape Base' / "Custom Base" / "Trapezoid Style Base" / "Tapered Leg Base" / '"T" Shaped Base With Beam' / "Panel Base With Beam" / "Waterfall Base" / "Custom Tambour Base" / "3 Leg Base"** | Off-list values allowed for unique designs (e.g., "Four-Leg - ADA") |
| P_Desc_BC_Size | Base Size | Text | Free text | |
| P_Desc_BC_Custom1 | Custom Description | Text | Free text line 1 | e.g., "2\" x 2\" square tubing legs with 2\" x 1\" apron" |
| P_Desc_BC_Custom2 | Custom Description | Text | Free text line 2 | |
| P_Desc_BC_Custom3 | Custom Description | Text | Free text line 3 | |
| P_Desc_BC_Custom4 | Custom Description | Text | Free text line 4 | |

### Base Finish Fields (Rows 109â€“118)
| RowKey | Label | Type | âœ… Valid Values | Notes |
|--------|-------|------|----------------|-------|
| P_Desc_B_Material | If Hardwood | âœ… Dropdown | **"Ash" / "Oak" / "Walnut" / "White Oak" / "Maple" / "Mahogany" / "2 Color"** | Only for hardwood bases |
| P_Desc_B_FinishType | Finish Type | âœ… Dropdown | **"Powder Coat" / "2 Color Powder Coat" / "Outdoor Powder Coat" / "Stained" / "Natural Color" / "Dyed"** | *(verified)* |
| P_Desc_B_FinishColor | Color - Color Description | Text | Free text | e.g., "Black", "Bronze", "Matte" |
| P_Desc_B_BrushedFinishDetail | Brushed Finish | âœ… Dropdown | **"*No Brushed Finish Detail" / "Enter Custom Note"** | Usually skip |
| P_Desc_B_FinishCustom1 | Custom Description | Text | Free text line 1 | e.g., "Hospitality-grade protective coat" |
| P_Desc_B_FinishCustom2 | Custom Description | Text | Free text line 2 | |
| P_Desc_B_FinishCustom3 | Custom Description | Text | Free text line 3 | |
| P_Desc_B_Feet | Feet | âœ… Dropdown | **"Adjustable Glides" / "Glides Non Adjustable" / "Bolt Down"** | *(verified)* |
| P_Desc_B_SpecialNote | Special Note for Base | Text | Free text | Warning/note text |

---

## HARDWOOD BASE MATERIAL BUILDER (Rows 131â€“201)

Four sub-components. Each has the same input pattern:

### Plank (Rows 132â€“147)
| RowKey | Label | Type | âœ… Valid Values | Notes |
|--------|-------|------|----------------|-------|
| P_BH_Plank_Width | W | Number (inches) | | Plank width |
| P_BH_Plank_Length | L - Grain Direction | Number (inches) | | Plank length |
| P_BH_Plank_Thickness | Thickness finish | Number (inches) | | Finished thickness |
| P_BH_Plank_QtyPerBase | Quantity Per Base | Number | | How many planks per base |
| P_BH_Plank_Material | Material | âœ… Dropdown | **"Red Oak" / "Ash" / "White Oak" / "Walnut" / "Maple" / "Mahogany"** | |
| P_BH_Plank_LumberThicknessRaw | Material Thickness | âœ… Dropdown | **'1"' / '1.5"' / '2"'** | Raw lumber thickness |

### Leg/Beam (Rows 149â€“164)
Same pattern: `P_BH_Leg_Width`, `P_BH_Leg_Length`, `P_BH_Leg_Thickness`, `P_BH_Leg_QtyPerBase`, `P_BH_Leg_Material`, `P_BH_Leg_LumberThicknessRaw`

### Apron Length (Rows 166â€“183)
Same pattern: `P_BH_ApronL_*`

### Apron Width (Rows 185â€“201)
Same pattern: `P_BH_ApronW_*`

---

## MATERIAL COSTS â€” INPUTS (Rows 336â€“729)

### Species Pricing
| RowKey | Label | Type | Location | Notes |
|--------|-------|------|----------|-------|
| P_Species1_CostPT | Price per BdFt | Currency | B448 (global) | *(from crawl)* Single price applied to all BdFt for this species |
| P_Species2_CostPT | Price per BdFt | Currency | B461 | Same pattern, species 2 |
| P_Species3â€“6_CostPT | Price per BdFt | Currency | B474, B488, B501, B514 | Species 3â€“6 |

### Stock Base Catalog Selector (Rows 93–102) *(verified — working as of March 2026)*

Ten rows that drive the catalog lookup system. Vendor and Style are set manually via static dropdowns. The remaining six are populated by the "Load Base Options" script action, which filters the external catalog to only valid options for the selected vendor + style. "Run Base Actions" then writes the matched price to P_SB_CostPB.

These rows use the same P_ prefix pattern — script writes to row from named range, column from active product column (E–V). They are input-only rows; no formulas read from them downstream other than through the script.

| RowKey | Row | Label | Type | Notes |
|--------|-----|-------|------|-------|
| P_SB_PriceLookup_Vendor | 93 | Vendor | ✅ Dropdown | **"NOROCK" / "JI Bases" / "PMI"** — static list, set in sheet. More vendors added as price lists are entered in catalog. |
| P_SB_PriceLookup_Style | 94 | Style / Series | ✅ Dropdown | Full combined style list — static. Script filters after vendor is chosen. e.g. "Trail", "X Base", "TR-Edge Round" |
| P_SB_PriceLookup_LoadOptions | 95 | Load Base Options | Checkbox | **Trigger row.** Check this, then run Quote Tools → Stock Base → Load Base Options. Script filters Size/Height/Color/JI dropdowns for the chosen vendor+style and auto-fills single-option fields. Unchecks automatically after running. |
| P_SB_PriceLookup_Size | 96 | Size | ✅ Dropdown (dynamic) | Populated by Load Base Options. Options vary by vendor+style. e.g. "22\"", "22x30\"", "22\" Rd" |
| P_SB_PriceLookup_Height | 97 | Height | ✅ Dropdown (dynamic) | Populated by Load Base Options. e.g. "Dining", "Bar", "Counter", "Modified" |
| P_SB_PriceLookup_Color | 98 | Finish / Color | ✅ Dropdown (dynamic) | Populated by Load Base Options. e.g. "Black (Standard)", "Black NL (Next-Level)", "Brushed Stainless (#304)" |
| P_SB_PriceLookup_JI_ColumnSize | 99 | Column Size (JI Only) | ✅ Dropdown (dynamic) | Populated for JI Bases only. Cleared automatically for NOROCK/PMI. e.g. "3\"", "4\"" |
| P_SB_PriceLookup_JI_TopPlate | 100 | Top Plate (JI Only) | ✅ Dropdown (dynamic) | Populated for JI Bases only. e.g. "TP12 (13\")", "TP17 (17\")" |
| P_SB_PriceLookup_JI_FootRing | 101 | Footring (JI Only) | ✅ Dropdown (dynamic) | Populated for JI Bases only. e.g. "None", "Yes (19\" dia)" |
| P_SB_PriceLookup_RunActions | 102 | Run Base Actions | Checkbox | **Trigger row.** Check this, then run Quote Tools → Stock Base → Run Base Actions. Script builds lookup key from the 8 selector fields, finds match in catalog, and writes Final Price to P_SB_CostPB. Unchecks automatically. Phase 2 will also fill shipping, hours, and description fields. |

**Lookup key format:** The script concatenates all 8 selector values with `|` separators:
`Vendor|Style|Size|Height|Color|JI_ColumnSize|JI_TopPlate|JI_FootRing`
This must match column A of the Base Catalog spreadsheet exactly. For non-JI bases, the last three segments are empty strings.

**Catalog location:** Separate Google Sheet (Base Catalog). Spreadsheet ID stored in `stock_base_selector_v2.js` constant `BASE_CATALOG_SS_ID`.

### Stock Base
| RowKey | Label | Type | Notes |
|--------|-------|------|-------|
| P_SB_CostPB | Stock Base unit cost | Currency | Per base, not per table. Multiplied by P_BaseQtyPP. Written by Run Base Actions script from catalog lookup. |

### Stock Base Shipping â€” GROUP COST *(verified)*
| RowKey | Label | Type | Notes |
|--------|-------|------|-------|
| P_SB_Shipping_Check | Checkbox | Boolean | Per product: does this product participate in this cost pool? |
| (Column C, row 568) | Total Cost | Currency | Job-level: total shipping cost to distribute |
| (Column A, row 569) | Distribution Type | âœ… "Units" / "Sq Ft" / "Bd Ft" | How to distribute proportionally. Sq Ft weights by table size *(verified)* |
| P_SB_Shipping_CostPP | Cost PP | Currency (formula) | Result: this product's per-table share of the total cost |

### Powder Coating
| RowKey | Label | Type | Notes |
|--------|-------|------|-------|
| P_PowderCoat1_PB | Powder Coating 1 unit cost | Currency | Per base unit |
| P_PowderCoat2_PB | Powder Coating 2 / Custom base cost | Currency | Per base unit |

### Unit Costs Base (UCB1â€“UCB4)
| RowKey Pattern | Fields per Slot | Notes |
|---------------|----------------|-------|
| P_UCBn_Description | Text | What this cost is for |
| P_UCBn_PB | Currency | Cost per base (not per table) |

### Group Costs Base (GCB1â€“GCB4) â€” GROUP COST pattern *(verified)*
Same three-row structure as Stock Base Shipping. Checkbox + Total in C + Type selector.

### Unit Costs Project (UC1â€“UC9)
| RowKey Pattern | Fields per Slot | Notes |
|---------------|----------------|-------|
| P_UCn_Description | Text | e.g., "power unit", "grommet" |
| P_UCn_CostPU | Currency | Unit price |
| P_UCn_UnitsPP | Number | Quantity per table |

### Group Costs Project (GC1â€“GC6) â€” GROUP COST pattern *(verified)*
Same three-row structure. Checkbox + Total in C + Type selector.

### Misc â€” GROUP COST pattern *(verified)*
| RowKey | Notes |
|--------|-------|
| P_Misc_Check | Checkbox per product |
| (C719) | Total misc cost |
| P_Misc_CostPP | Per-table result |

### Consumables â€” GROUP COST pattern *(verified)*
| RowKey | Notes |
|--------|-------|
| P_Consumables_Check | Checkbox per product |
| (C723) | Total consumables cost |
| P_Consumables_CostPP | Per-table result |

---

## HOURS â€” INPUTS (Rows 730â€“1156)

### Rate Inputs (Column B, global â€” not per product)
| Row | Label | Type | Example | Notes |
|-----|-------|------|---------|-------|
| B770 | LC101 Processing rate | SqFt/hr | 14 | *(Stability across jobs: TBD)* |
| B777 | LC102 Belt Sanding rate | SqFt/hr | 30 | |
| B782 | LC103 Cutting Top rate | Panels/hr | 8 | |
| B788 | LC103 Cutting Base rate | Panels/hr | 8 | |
| B795 | LC103 Other panels rate | Panels/hr | 8 | |

### Checkbox Inputs (per product, per labor center)
| RowKey | Label | Notes |
|--------|-------|-------|
| P_LC103_TopPanel_Check | Top panel cutting | TRUE = include top panels in cutting calc. Set for all hardwood tops. *(verified)* |
| P_LC103_HBPlank_Check | Base plank cutting | TRUE = include HB plank panels. Custom hardwood base only. |
| P_LC103_HBLeg_Check | Base leg cutting | TRUE = include HB leg panels. Custom hardwood base only. |

âš ï¸ **There is no generic `P_LC103_Check`.** Only the three specific names above exist. *(verified)*

### Unit Hours (UH) â€” Direct Input per Product
| RowKey Pattern | Label | Type | Notes |
|---------------|-------|------|-------|
| P_LCxxx_UH1_HoursPU | Hours per table | Number | Direct hour entry â€” bypasses rate calculations |
| P_LCxxx_UH2_HoursPU | Hours per table (slot 2) | Number | Second UH slot where available |

### Group Hours (GH) â€” GROUP COST Pattern Applied to Hours
Same three-row structure as Group Costs but distributing hours instead of dollars.
| RowKey Pattern | Notes |
|---------------|-------|
| P_LCxxx_GH1_Check | Checkbox per product |
| (Column C) | Total hours to distribute |
| P_LCxxx_GH1_HoursPP | Per-table result |

### Tag Labels (Column A)
The label in column A for certain rows (UH, GH, Other panels, etc.) can be set to:
- âœ… "Top / General" (default) / "Base" / "Feature 1" / "Feature 2" / "none"

This tags the hours for the summary breakdown at rows 1172â€“1175. *(What "features" means in practice: TBD)*

---

## FINAL PRICING â€” INPUTS (Rows 1181â€“1283)

### Margin Rates (per product column)
| RowKey | Label | Default | Notes |
|--------|-------|---------|-------|
| P_Hardwood_MarginRate | Hardwood Margin | 0.05 | Applied to top hardwood cost only |
| P_Stone_MarginRate | Stone Margin | 0.25 | |
| P_StockBase_MarginRate | Stock Base Margin | 0.25 | |
| P_StockBaseShipping_MarginRate | SB Shipping Margin | 0.05 | |
| P_PowderCoat1_MarginRate | Powder Coat Margin | 0.10 | |
| P_CustomBaseCost_MarginRate | Custom Base Margin | 0.05 | |
| P_UnitCost_MarginRate | Unit Cost Margin | 0.05 | |
| P_GroupCost_MarginRate | Group Cost Margin | 0.05 | |
| P_Misc_MarginRate | Misc Margin | 0.00 | |
| P_Consumables_MarginRate | Consumables Margin | 0.00 | |

### Pricing Controls
| RowKey | Label | Type | Default | Notes |
|--------|-------|------|---------|-------|
| P_HourlyRate | Hourly Rate per table | Currency | $155 | *(Is this the desired shop rate? Per product or global? TBD)* |
| P_FinalAdjustmentRate | Final Price Adjustment | Number | 1.0 | Multiplier on entire price. *(When used: TBD)* |

### Global Inputs (Column B/C, not per product)
| Cell | Label | Type | âœ… Valid Values | Notes |
|------|-------|------|----------------|-------|
| B4 | REP - Yes or No | âœ… Dropdown | **"Yes" / "No"** | Toggles rep commission |
| C4 | Rep commission rate | Decimal | | 0.08 = 8% |

---

## CHANGELOG

| Date | Section | Change |
|------|---------|--------|
| 2026-02-09 | Initial | Created from formula crawl |
| 2026-02-09 | Group Cost fields | Added *(verified)* tags and detailed notes from voice interview explaining checkbox gating, distribution types, and per-unit resolution |
| 2026-02-15 | ALL sections | **Major update from real-world test.** Added exact data validation lists (âœ…) extracted from sheet. Fixed: MaterialType "Stone" â†’ "Stone 1", BaseType "Custom" â†’ "Custom Base", EdgeProfile "Eased" â†’ "Eased Edge", SheenORFinish "Semi-Gloss" â†’ "Semi Gloss". Documented critical StainORColor vs ColorName two-field pattern. Added stone thickness requirement. Added LC103 checkbox verification. Marked all confirmed fields *(verified)*. |
| 2026-03-17 | Stock Base Costs | **New: Stock Base Catalog Selector section (rows 93–102).** Documented 10 new P_SB_PriceLookup_ named ranges. Two trigger checkboxes (LoadOptions row 95, RunActions row 102). Six dynamically-loaded dropdown fields (Size, Height, Color, JI Column, JI Top Plate, JI Footring). Lookup key format documented. Updated P_SB_CostPB note to reflect script write via Run Base Actions. |
