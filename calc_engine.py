"""
Simply Tables — Calculation Engine V2 (Quote Block Architecture)

Pure-function engine that computes all derived values for quotes.
No database calls — receives data dicts, returns computed results.

Mirrors the Pricing Sheet V5 aggregation hierarchy:
    PU/PB → PP → PT → Option Total → Quote Total

Three block patterns:
    Unit Block:  value × multiplier → PP
    Group Block: lump sum ÷ proportional → PP
    Rate Block:  metric ÷ rate → proportional hours

V2 change: blocks are now quote-level with per-product members,
instead of per-product blocks + separate group pools.
"""

from __future__ import annotations

import math
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

# ──────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────

WASTE_FACTOR_TOP = Decimal("1.3")       # 30% waste on top lumber
WASTE_FACTOR_BASE = Decimal("1.25")     # 25% waste on base lumber (known discrepancy, should be 1.3)

# Lumber thickness string → raw decimal inches (from reference table rows 1404-1410)
THICKNESS_LOOKUP: dict[str, Decimal] = {
    '1"':    Decimal("1.0"),
    '.75"':  Decimal("1.0"),
    '1.25"': Decimal("1.5"),
    '1.5"':  Decimal("2.0"),
    '1.75"': Decimal("2.0"),
    '2"':    Decimal("2.0"),
    '2.25"': Decimal("2.5"),
    '2.5"':  Decimal("2.5"),
}

# Lumber thickness string → quarter code (for species key generation)
QUARTER_CODE_LOOKUP: dict[str, str] = {
    '1"':    "4/4",
    '.75"':  "4/4",
    '1.25"': "6/4",
    '1.5"':  "8/4",
    '1.75"': "8/4",
    '2"':    "8/4",
    '2.25"': "10/4",
    '2.5"':  "10/4",
}

# Component raw thickness (inches) → quarter code
# Used by Material Builder to derive species_key for plank/leg components.
# Raw thickness is the actual rough-sawn dimension (e.g. 8/4 board = 2.0" rough).
COMPONENT_QUARTER_CODE_LOOKUP: dict[str, str] = {
    "1.0": "4/4",
    "1.5": "6/4",
    "2.0": "8/4",
    "2.5": "10/4",
}


# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────

def _d(value) -> Decimal:
    """Coerce to Decimal safely."""
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _round2(value: Decimal) -> Decimal:
    """Round to 2 decimal places (currency)."""
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _round4(value: Decimal) -> Decimal:
    """Round to 4 decimal places (intermediate calcs)."""
    return value.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


# ──────────────────────────────────────────────────────────────────────
# 1. Dimensions
# ──────────────────────────────────────────────────────────────────────

def compute_dimensions(product: dict) -> dict:
    """
    Compute sq_ft and bd_ft from product specs.

    Returns dict with: sq_ft, sq_ft_wl, bd_ft, raw_thickness, quarter_code

    Sheet formulas:
        Row 55: SqFt = (Width/12) × (Length/12)  ← sq_ft_wl, used for group pools + rate labor
        Row 56: SqFt if DIA = π × (Width/24)²    ← sq_ft, used for material cost (per_sqft blocks)
        Row 54: BdFt = (Width × Length × RawThickness / 144) × 1.3

    IMPORTANT: sq_ft_wl is always W×L regardless of shape. Group cost/labor pools and
    rate-based labor blocks use sq_ft_wl (matching the sheet). Per-sqft cost blocks
    (material pricing) use sq_ft which is DIA-adjusted for circular tops.
    """
    width = _d(product.get("width"))
    length = _d(product.get("length"))
    shape = product.get("shape", "Standard")
    thickness_str = product.get("lumber_thickness", "")
    material_type = product.get("material_type", "")

    # W×L square footage — always used for group pools and rate labor (sheet row 55)
    if width > 0 and length > 0:
        sq_ft_wl = _round4((width / Decimal("12")) * (length / Decimal("12")))
    else:
        sq_ft_wl = Decimal("0")

    # DIA-adjusted square footage — used for per_sqft material cost blocks (sheet row 56)
    if shape == "DIA":
        # Circular: π × (diameter/24)² — diameter is in the width field
        radius_ft = width / Decimal("24")
        sq_ft = _round4(Decimal(str(math.pi)) * radius_ft * radius_ft)
    else:
        sq_ft = sq_ft_wl

    # Board footage (hardwood and live edge only)
    bd_ft = Decimal("0")
    raw_thickness = Decimal("0")
    quarter_code = ""

    if material_type in ("Hardwood", "Live Edge") and thickness_str:
        raw_thickness = THICKNESS_LOOKUP.get(thickness_str, Decimal("0"))
        quarter_code = QUARTER_CODE_LOOKUP.get(thickness_str, "")

        if width > 0 and length > 0 and raw_thickness > 0:
            bd_ft = _round4(
                (width * length * raw_thickness / Decimal("144")) * WASTE_FACTOR_TOP
            )

    return {
        "sq_ft": sq_ft,
        "sq_ft_wl": sq_ft_wl,
        "bd_ft": bd_ft,
        "raw_thickness": raw_thickness,
        "quarter_code": quarter_code,
    }


def compute_dimension_string(product: dict) -> str:
    """
    Build the customer-facing dimension string.

    Sheet formulas (rows 1539-1541):
        Standard: '36" x 48" - Dining Height'
        DIA:      '30" DIA - Bar Height'
        Custom:   '36" x 48" x 38"H - Half Pill'
    """
    width = product.get("width", "")
    length = product.get("length", "")
    shape = product.get("shape", "Standard")
    height_name = product.get("height_name", "")
    height_input = product.get("height_input", "")
    shape_custom = product.get("shape_custom", "")

    # Base dimension
    if shape == "DIA":
        dim = f'{width}" DIA'
    elif width and length:
        dim = f'{width}" x {length}"'
    else:
        return ""

    # Height
    if height_name == "Custom Height" and height_input:
        dim = f'{dim} x {height_input}"H'
    elif height_name and height_name != "Top Only":
        dim = f"{dim} - {height_name}"

    # Custom shape suffix
    if shape == "Custom Shape" and shape_custom:
        dim = f"{dim} - {shape_custom}"

    return dim


# ──────────────────────────────────────────────────────────────────────
# 2. Component Dimensions (Material Builder)
# ──────────────────────────────────────────────────────────────────────

def compute_component(component: dict, product: dict) -> dict:
    """
    Compute bdft and sqft for a single product component (Material Builder).

    Feeds into:
    - Species pipeline: plank/leg/apron components contribute bdft to their species_key
    - Panel data pipeline: plank/leg components add sqft + count to panel totals

    Dimensions are L × W × D (depth). Board footage = volume:
        bd_ft_per_piece = (L × W × D / 144) × waste_factor

    If depth is not set, falls back to lumber thickness for backward compatibility.

    Waste factor comes from the species assignment (default 25%), applied in the
    species pipeline. Here we compute raw volume without waste — the pipeline
    applies the waste factor when it has access to the species assignment.

    Sheet reference: Rows 131–201 (Hardwood Base Material Builder).
    """
    width = _d(component.get("width", 0))
    length = _d(component.get("length", 0))
    depth = _d(component.get("depth", 0))
    thickness = _d(component.get("thickness", 0))   # raw lumber inches (for species key)
    qty_per_base = int(component.get("qty_per_base", 1) or 1)
    bases_per_top = int(product.get("bases_per_top", 1) or 1)

    # Use depth for volume; fall back to thickness for legacy flat-board components
    dim3 = depth if depth > 0 else thickness

    # Board footage per piece: (L × W × D / 144) — raw, no waste
    # Waste is applied by the species pipeline using the species assignment's waste_factor
    if width > 0 and length > 0 and dim3 > 0:
        bd_ft_per_piece = _round4(
            (width * length * dim3 / Decimal("144"))
        )
    else:
        bd_ft_per_piece = Decimal("0")

    # Per product (one table): pieces_per_base × bases_per_top
    bd_ft_pp = _round4(bd_ft_per_piece * qty_per_base * bases_per_top)

    # Square footage
    if width > 0 and length > 0:
        sq_ft_per_piece = _round4((width * length) / Decimal("144"))
    else:
        sq_ft_per_piece = Decimal("0")

    sq_ft_pp = _round4(sq_ft_per_piece * qty_per_base * bases_per_top)

    return {
        "bd_ft_per_piece": bd_ft_per_piece,
        "bd_ft_pp": bd_ft_pp,
        "sq_ft_per_piece": sq_ft_per_piece,
        "sq_ft_pp": sq_ft_pp,
    }


# ──────────────────────────────────────────────────────────────────────
# 3. Panel Data
# ──────────────────────────────────────────────────────────────────────

def compute_panel_data(product: dict) -> dict:
    """
    Compute panel sqft and panel count for rate labor pipeline.

    Panel data drives rate-based labor centers (LC101, LC102, LC103, LC106, LC109):
        panel_sqft  — total surface area of all panels (top + components), in sq ft
        panel_count — number of distinct panels (top + components per product config)

    Top panel: produced by Hardwood, Live Edge, Laminate products.
        panel_sqft += sq_ft_wl (W×L, NOT DIA-adjusted — matches verified 0737 numbers)
        panel_count += 1

    Component panels: from product_components of type 'plank' or 'leg'.
        Added by Material Builder pipeline (Item 6). Not yet populated.
        panel_sqft += component.sq_ft_pp
        panel_count += component.qty_per_base × bases_per_top

    Sheet reference: Rows 735–762 (panel data section).
    LC103 Cutting uses panel_count as its metric (panels/hr), all others use panel_sqft (sqft/hr).
    """
    material_type = product.get("material_type", "")

    # Top panel
    top_panel_sqft = Decimal("0")
    top_panel_count = 0

    if material_type in ("Hardwood", "Live Edge", "Laminate"):
        top_panel_sqft = _d(product.get("sq_ft_wl", 0))
        top_panel_count = 1

    # Component panels (Material Builder — Item 6, not yet built)
    component_panel_sqft = Decimal("0")
    component_panel_count = 0

    bases_per_top = int(product.get("bases_per_top", 1) or 1)
    for comp in product.get("components", []):
        if comp.get("component_type") in ("plank", "leg"):
            component_panel_sqft += _d(comp.get("sq_ft_pp", 0))
            component_panel_count += int(comp.get("qty_per_base", 1) or 1) * bases_per_top

    return {
        "panel_sqft": _round4(top_panel_sqft + component_panel_sqft),
        "panel_count": top_panel_count + component_panel_count,
    }


# ──────────────────────────────────────────────────────────────────────
# 4. Unit Cost Block (per member)
# ──────────────────────────────────────────────────────────────────────

def compute_cost_block(block: dict, member: dict, product: dict) -> dict:
    """
    Compute a unit cost block for a specific product member.

    Uses member-level cost_per_unit override if present, otherwise block-level.

    multiplier_type determines the cost formula:
        'per_unit'  → cost_pp = cost_per_unit (flat cost per table)
        'fixed'     → same as per_unit (legacy alias)
        'per_piece' → cost_pp = cost_per_unit × units_per_product (member-level pieces)
        'per_base'  → cost_pp = cost_per_unit × bases_per_top
        'per_sqft'  → cost_pp = cost_per_unit × sq_ft (built-in stone pipeline)
        'per_bdft'  → cost_pp = cost_per_unit × bd_ft (built-in species pipeline)

    Sheet pattern (Unit Block):
        PP = CostPU × Multiplier
        PT = PP × Quantity
    """
    # Member override takes precedence over block-level value
    cost_per_unit = _d(member.get("cost_per_unit") if member.get("cost_per_unit") is not None else block.get("cost_per_unit"))
    multiplier_type = block.get("multiplier_type", "per_unit")
    quantity = _d(product.get("quantity", 1))

    # Resolve the multiplier
    if multiplier_type == "per_base":
        multiplier = _d(product.get("bases_per_top", 1))
    elif multiplier_type == "per_sqft":
        # Member override (pipeline stores per-group sqft) → product sq_ft fallback
        multiplier = _d(member.get("units_per_product") if member.get("units_per_product") is not None else product.get("sq_ft", 0))
    elif multiplier_type == "per_bdft":
        # Member override (pipeline stores per-species bdft) → product bd_ft fallback
        multiplier = _d(member.get("units_per_product") if member.get("units_per_product") is not None else product.get("bd_ft", 0))
    elif multiplier_type == "per_piece":
        # Pieces mode: use member-level units_per_product (pieces per table)
        multiplier = _d(member.get("units_per_product") if member.get("units_per_product") is not None else block.get("units_per_product", 1))
    elif multiplier_type in ("per_unit", "fixed"):
        # Units mode: flat cost per table, no multiplier
        multiplier = Decimal("1")
    else:
        multiplier = Decimal("1")

    cost_pp = _round4(cost_per_unit * multiplier)
    cost_pt = _round4(cost_pp * quantity)

    return {
        "cost_pp": cost_pp,
        "cost_pt": cost_pt,
    }


# ──────────────────────────────────────────────────────────────────────
# 5. Group Cost Block (distribute across members)
# ──────────────────────────────────────────────────────────────────────

def compute_group_cost_block(block: dict, members: list[dict], products: dict[str, dict]) -> list[dict]:
    """
    Distribute a lump-sum cost across participating product members proportionally.

    block: the quote_block record (block_type = "group", block_domain = "cost")
    members: list of member records (each has product_id)
    products: dict of product_id → product data (must include sq_ft, bd_ft, quantity)

    Returns: list of updated member dicts with metric_value, cost_pp, cost_pt

    Sheet pattern (Group Block):
        metric_value = product's contribution (qty, sqft*qty, bdft*qty)
        rate = total_amount / sum(all metric_values)
        cost_pp = metric_value / quantity × rate
        cost_pt = cost_pp × quantity
    """
    total_amount = _d(block.get("total_amount", 0))
    dist_type = block.get("distribution_type", "units")

    if total_amount == 0 or not members:
        return [
            {**m, "metric_value": Decimal("0"), "cost_pp": Decimal("0"), "cost_pt": Decimal("0")}
            for m in members
        ]

    # Calculate metric for each participating product
    results = []
    for member in members:
        pid = member["product_id"]
        prod = products.get(pid, {})
        qty = _d(prod.get("quantity", 1))

        if dist_type == "sqft":
            # Use W×L sqft (sq_ft_wl) matching sheet row 55 — NOT DIA-adjusted sq_ft
            metric = _d(prod.get("sq_ft_wl", prod.get("sq_ft", 0))) * qty
        elif dist_type == "bdft":
            metric = _d(prod.get("bd_ft", 0)) * qty
        else:  # units
            metric = qty

        results.append({
            **member,
            "metric_value": metric,
            "_qty": qty,
        })

    # Sum of all metrics
    total_metric = sum(r["metric_value"] for r in results)

    if total_metric == 0:
        return [
            {**r, "cost_pp": Decimal("0"), "cost_pt": Decimal("0")}
            for r in results
        ]

    # Distribute: rate = total / sum(metrics), cost_pp = metric/qty × rate
    rate = total_amount / total_metric

    for r in results:
        qty = r.pop("_qty")
        if qty > 0:
            r["cost_pp"] = _round4(r["metric_value"] / qty * rate)
            r["cost_pt"] = _round4(r["cost_pp"] * qty)
        else:
            r["cost_pp"] = Decimal("0")
            r["cost_pt"] = Decimal("0")

    return results


# ──────────────────────────────────────────────────────────────────────
# 6. Labor Blocks
# ──────────────────────────────────────────────────────────────────────

def compute_labor_block(
    block: dict,
    member: dict,
    product: dict,
    all_products_metric_total: Optional[Decimal] = None,
    all_products_qty_total: Optional[Decimal] = None,
) -> dict:
    """
    Compute a labor block's hours for a specific product member.

    block_type determines the calculation:

    'unit': Direct hours input.
        hours_pp = hours_per_unit (member override or block-level)
        hours_pt = hours_pp × quantity

    'rate': Proportional hours from a rate.
        Two rate_type modes:

        rate_type='metric' (default — sqft/hr, panels/hr, bdft/hr):
            total_hours = total_metric / rate_value
            hours_pp = product_metric / rate_value  (simplifies to same result cross-product)

        rate_type='units' (tables/hr — LC104 CNC pattern):
            total_hours = total_qty / rate_value
            hours_pp = (product_metric / total_metric) × total_hours / qty
            Requires all_products_metric_total AND all_products_qty_total.

    metric_source options:
        'panel_sqft'  — sq_ft_wl of top + component sqft (W×L always)
        'panel_count' — number of distinct panels (LC103 Cutting)
        'top_sqft'    — sq_ft_wl (W×L, not DIA-adjusted; standard for rate labor)
        'sq_ft'       — DIA-adjusted sqft (use for LC104 when DIA products participate)
        'bd_ft'       — board footage

    'group': Handled by compute_group_labor_block (same pattern as group cost blocks)
    """
    block_type = block.get("block_type", "unit")
    quantity = _d(product.get("quantity", 1))

    # Check member-level is_active override, then block-level
    is_active = member.get("is_active") if member.get("is_active") is not None else block.get("is_active", True)

    if not is_active:
        return {"hours_pp": Decimal("0"), "hours_pt": Decimal("0")}

    if block_type == "unit":
        # Member override takes precedence
        hours_per_unit = member.get("hours_per_unit") if member.get("hours_per_unit") is not None else block.get("hours_per_unit", 0)
        hours_pp = _d(hours_per_unit)
        hours_pt = hours_pp * quantity
        return {"hours_pp": hours_pp, "hours_pt": hours_pt}

    elif block_type == "rate":
        rate_value = _d(block.get("rate_value", 0))
        metric_source = block.get("metric_source", "top_sqft")
        rate_type = block.get("rate_type", "metric")

        # Resolve this product's metric.
        if metric_source == "panel_sqft":
            product_metric = _d(product.get("panel_sqft", product.get("sq_ft_wl", product.get("sq_ft", 0))))
        elif metric_source == "panel_count":
            product_metric = _d(product.get("panel_count", 0))
        elif metric_source == "sq_ft":
            product_metric = _d(product.get("sq_ft", product.get("sq_ft_wl", 0)))
        elif metric_source == "top_sqft":
            product_metric = _d(product.get("sq_ft_wl", product.get("sq_ft", 0)))
        elif metric_source == "bd_ft":
            product_metric = _d(product.get("bd_ft", 0))
        else:
            product_metric = _d(product.get("sq_ft_wl", product.get("sq_ft", 0)))

        if rate_value == 0:
            return {"hours_pp": Decimal("0"), "hours_pt": Decimal("0")}

        if rate_type == "units":
            if (all_products_metric_total and all_products_metric_total > 0
                    and all_products_qty_total and all_products_qty_total > 0
                    and product_metric > 0):
                total_hours = all_products_qty_total / rate_value
                product_metric_pt = product_metric * quantity
                hours_pp = (product_metric_pt / all_products_metric_total) * total_hours / quantity
            else:
                hours_pp = Decimal("0")
        else:
            # rate_type='metric' (default)
            if product_metric == 0:
                return {"hours_pp": Decimal("0"), "hours_pt": Decimal("0")}
            if all_products_metric_total and all_products_metric_total > 0:
                total_hours = all_products_metric_total / rate_value
                product_metric_pt = product_metric * quantity
                hours_pp = (product_metric_pt / all_products_metric_total) * total_hours / quantity
            else:
                hours_pp = product_metric / rate_value

        hours_pt = hours_pp * quantity
        return {"hours_pp": hours_pp, "hours_pt": hours_pt}

    # Group type handled by compute_group_labor_block
    return {"hours_pp": Decimal("0"), "hours_pt": Decimal("0")}


def compute_group_labor_block(block: dict, members: list[dict], products: dict[str, dict]) -> list[dict]:
    """
    Distribute lump-sum hours across participating product members.
    Same pattern as group cost blocks but for hours.
    """
    total_hours = _d(block.get("total_hours", 0))
    dist_type = block.get("distribution_type", "units")

    if total_hours == 0 or not members:
        return [
            {**m, "metric_value": Decimal("0"), "hours_pp": Decimal("0"), "hours_pt": Decimal("0")}
            for m in members
        ]

    results = []
    for member in members:
        pid = member["product_id"]
        prod = products.get(pid, {})
        qty = _d(prod.get("quantity", 1))

        if dist_type == "sqft":
            metric = _d(prod.get("sq_ft_wl", prod.get("sq_ft", 0))) * qty
        elif dist_type == "bdft":
            metric = _d(prod.get("bd_ft", 0)) * qty
        else:
            metric = qty

        results.append({**member, "metric_value": metric, "_qty": qty})

    total_metric = sum(r["metric_value"] for r in results)

    if total_metric == 0:
        return [
            {**r, "hours_pp": Decimal("0"), "hours_pt": Decimal("0")}
            for r in results
        ]

    rate = total_hours / total_metric
    for r in results:
        qty = r.pop("_qty")
        if qty > 0:
            r["hours_pp"] = r["metric_value"] / qty * rate
            r["hours_pt"] = r["hours_pp"] * qty
        else:
            r["hours_pp"] = Decimal("0")
            r["hours_pt"] = Decimal("0")

    return results


# ──────────────────────────────────────────────────────────────────────
# 7. Product Pricing Assembly
# ──────────────────────────────────────────────────────────────────────

def compute_product_pricing(
    product: dict,
    cost_results: list[dict],
    labor_results: list[dict],
    quote: dict,
) -> dict:
    """
    Assemble final pricing for a single product.

    cost_results: list of dicts with cost_pp, cost_category (from all cost blocks for this product)
    labor_results: list of dicts with hours_pp, labor_center (from all labor blocks for this product)

    Sheet logic (rows 1183-1283):
        1. Sum material costs by category
        2. Apply per-category margin rates
        3. Total material price = sum of (cost × (1 + margin)) per category
        4. Total hours × hourly rate = hours price
        5. Price = material price + hours price
        6. Final price = price × final adjustment rate
        7. Sale price = final price × (1 + rep rate) if has_rep
        8. Sale price total = sale price × quantity
    """
    quantity = _d(product.get("quantity", 1))
    hourly_rate = _d(product.get("hourly_rate", 155))
    adjustment_rate = _d(product.get("final_adjustment_rate", 1))
    has_rep = quote.get("has_rep", True)
    rep_rate = _d(quote.get("rep_rate", "0.08"))

    # ── Step 1 + 2: Apply per-block margin rates ──
    # Each cost_result carries its own margin_rate from the block.
    total_cost_pp = Decimal("0")
    total_margin_pp = Decimal("0")
    total_material_price_pp = Decimal("0")
    margin_detail = {}

    for item in cost_results:
        cost_pp = _d(item.get("cost_pp", 0))
        margin_rate = _d(item.get("margin_rate", "0.05"))

        cost_with_margin = _round4(cost_pp * (Decimal("1") + margin_rate))
        margin_dollars = cost_with_margin - cost_pp

        total_cost_pp += cost_pp
        total_margin_pp += margin_dollars
        total_material_price_pp += cost_with_margin

        # Aggregate into margin_detail by category (for summary/display)
        cat = item.get("cost_category", "other")
        if cat not in margin_detail:
            margin_detail[cat] = {
                "cost_pp": Decimal("0"),
                "margin_rate": margin_rate,
                "margin_pp": Decimal("0"),
                "price_pp": Decimal("0"),
            }
        margin_detail[cat]["cost_pp"] += cost_pp
        margin_detail[cat]["margin_pp"] += margin_dollars
        margin_detail[cat]["price_pp"] += cost_with_margin

    # ── Step 3: Aggregate hours ──
    total_hours_pp = Decimal("0")
    hours_by_lc: dict[str, Decimal] = {}

    for item in labor_results:
        lc = item.get("labor_center", "unknown")
        hrs = _d(item.get("hours_pp", 0))
        total_hours_pp += hrs
        hours_by_lc[lc] = hours_by_lc.get(lc, Decimal("0")) + hrs

    # ── Step 4: Price assembly ──
    hours_price = _round2(total_hours_pp * hourly_rate)
    price_pp = _round2(total_material_price_pp + hours_price)
    final_price_pp = _round2(price_pp * adjustment_rate)

    if has_rep:
        sale_price_pp = _round2(final_price_pp * (Decimal("1") + rep_rate))
    else:
        sale_price_pp = final_price_pp

    sale_price_total = _round2(sale_price_pp * quantity)

    # ── Step 5: Analysis metrics ──
    total_hours_pt = _round4(total_hours_pp * quantity)
    effective_shop_rate = Decimal("0")
    if total_hours_pp > 0:
        hours_revenue = final_price_pp - total_material_price_pp
        effective_shop_rate = _round2(hours_revenue / total_hours_pp)

    return {
        # Cost summary
        "total_material_cost": _round2(total_cost_pp),
        "total_material_margin": _round2(total_margin_pp),
        "total_material_price": _round2(total_material_price_pp),
        # Hours summary
        "total_hours_pp": _round4(total_hours_pp),
        "total_hours_pt": total_hours_pt,
        "hours_by_labor_center": hours_by_lc,
        # Price assembly
        "hours_price": hours_price,
        "price_pp": price_pp,
        "final_price_pp": final_price_pp,
        "sale_price_pp": sale_price_pp,
        "sale_price_total": sale_price_total,
        # Analysis
        "effective_shop_rate": effective_shop_rate,
        "margin_detail": margin_detail,
    }


# ──────────────────────────────────────────────────────────────────────
# 8. Tag Summary
# ──────────────────────────────────────────────────────────────────────

def compute_tag_summary(
    cost_results: list[dict],
    labor_results: list[dict],
    tags: dict[str, str],   # tag_id → tag_name
) -> dict[str, dict]:
    """
    Aggregate costs and hours by tag for price breakdown.

    Returns: {tag_name: {"cost_pp": x, "hours_pp": y, "cost_pt": z, "hours_pt": w}}
    """
    summary: dict[str, dict] = {}

    def _add(tag_id, cost_pp=None, cost_pt=None, hours_pp=None, hours_pt=None):
        tag_name = tags.get(tag_id, "Untagged") if tag_id else "Untagged"
        if tag_name not in summary:
            summary[tag_name] = {
                "cost_pp": Decimal("0"),
                "cost_pt": Decimal("0"),
                "hours_pp": Decimal("0"),
                "hours_pt": Decimal("0"),
            }
        if cost_pp:
            summary[tag_name]["cost_pp"] += _d(cost_pp)
        if cost_pt:
            summary[tag_name]["cost_pt"] += _d(cost_pt)
        if hours_pp:
            summary[tag_name]["hours_pp"] += _d(hours_pp)
        if hours_pt:
            summary[tag_name]["hours_pt"] += _d(hours_pt)

    for b in cost_results:
        _add(b.get("tag_id"), cost_pp=b.get("cost_pp"), cost_pt=b.get("cost_pt"))
    for b in labor_results:
        _add(b.get("tag_id"), hours_pp=b.get("hours_pp"), hours_pt=b.get("hours_pt"))

    return summary


# ──────────────────────────────────────────────────────────────────────
# 9. Option & Quote Totals
# ──────────────────────────────────────────────────────────────────────

def compute_option_totals(product_results: list[dict]) -> dict:
    """
    Roll up product-level pricing to option totals.
    """
    total_cost = Decimal("0")
    total_price = Decimal("0")
    total_hours = Decimal("0")

    for pr in product_results:
        qty = _d(pr.get("quantity", 1))
        total_cost += _d(pr.get("total_material_cost", 0)) * qty
        total_price += _d(pr.get("sale_price_total", 0))
        total_hours += _d(pr.get("total_hours_pt", 0))

    return {
        "total_cost": _round2(total_cost),
        "total_price": _round2(total_price),
        "total_hours": _round4(total_hours),
    }


def compute_quote_totals(option_results: list[dict], shipping: Decimal = Decimal("0")) -> dict:
    """
    Roll up option totals to quote level.
    """
    total_cost = sum(_d(o.get("total_cost", 0)) for o in option_results)
    total_price = sum(_d(o.get("total_price", 0)) for o in option_results)
    total_hours = sum(_d(o.get("total_hours", 0)) for o in option_results)
    grand_total = _round2(total_price + _d(shipping))

    return {
        "total_cost": _round2(total_cost),
        "total_price": _round2(total_price),
        "total_hours": _round4(total_hours),
        "grand_total": grand_total,
    }


# ──────────────────────────────────────────────────────────────────────
# 10. Full Quote Computation (Orchestrator)
# ──────────────────────────────────────────────────────────────────────

def compute_quote(quote_data: dict) -> dict:
    """
    Top-level orchestrator. Takes a full quote data structure and computes
    every derived value.

    V2 input structure:
    {
        "quote": { id, has_rep, rep_rate, shipping, ... },
        "tags": { tag_id: tag_name, ... },
        "options": [
            {
                "id": ...,
                "products": [
                    { "id": ..., "quantity": 2, "width": 36, ... , "components": [...] },
                    ...
                ],
            },
        ],
        "quote_blocks": [
            {
                "id": ..., "block_domain": "cost", "block_type": "unit",
                "cost_category": "unit_cost", "cost_per_unit": 50, ...
                "members": [
                    { "id": ..., "product_id": "...", "cost_per_unit": null, ... },
                    ...
                ],
            },
            ...
        ],
    }

    Returns the same structure with all computed fields populated on members and products.
    """
    quote = quote_data.get("quote", {})
    tags = quote_data.get("tags", {})
    options = quote_data.get("options", [])
    quote_blocks = quote_data.get("quote_blocks", [])

    # Build product lookup
    all_products: dict[str, dict] = {}
    for option in options:
        for product in option.get("products", []):
            all_products[product["id"]] = product

    # ── Phase 1: Compute dimensions for all products ──
    for pid, product in all_products.items():
        dims = compute_dimensions(product)
        product.update(dims)
        product["dimension_string"] = compute_dimension_string(product)

    # ── Phase 1.25: Compute component dimensions (Material Builder) ──
    for pid, product in all_products.items():
        for comp in product.get("components", []):
            comp.update(compute_component(comp, product))

    # ── Phase 1.5: Compute panel data ──
    for pid, product in all_products.items():
        panel_data = compute_panel_data(product)
        product.update(panel_data)

    # ── Phase 2: Pre-compute cross-product totals for rate_type='units' labor blocks ──
    _units_metric_totals: dict[str, Decimal] = {}  # block_id → total metric
    _units_qty_totals: dict[str, Decimal] = {}     # block_id → total qty

    for block in quote_blocks:
        if block.get("block_domain") == "labor" and block.get("block_type") == "rate" and block.get("rate_type") == "units":
            bid = block["id"]
            metric_source = block.get("metric_source", "top_sqft")
            for member in block.get("members", []):
                pid = member["product_id"]
                prod = all_products.get(pid, {})
                qty = _d(prod.get("quantity", 1))
                if metric_source == "sq_ft":
                    metric = _d(prod.get("sq_ft", prod.get("sq_ft_wl", 0)))
                elif metric_source == "panel_sqft":
                    metric = _d(prod.get("panel_sqft", prod.get("sq_ft_wl", 0)))
                elif metric_source == "panel_count":
                    metric = _d(prod.get("panel_count", 0))
                elif metric_source == "bd_ft":
                    metric = _d(prod.get("bd_ft", 0))
                else:
                    metric = _d(prod.get("sq_ft_wl", prod.get("sq_ft", 0)))
                _units_metric_totals[bid] = _units_metric_totals.get(bid, Decimal("0")) + metric * qty
                _units_qty_totals[bid] = _units_qty_totals.get(bid, Decimal("0")) + qty

    # ── Phase 2.5: Pre-compute cross-product totals for rate_type='metric' rate blocks ──
    # Needed for proportional distribution across members
    _metric_totals: dict[str, Decimal] = {}  # block_id → total metric*qty across all members

    for block in quote_blocks:
        if block.get("block_domain") == "labor" and block.get("block_type") == "rate" and block.get("rate_type", "metric") == "metric":
            bid = block["id"]
            metric_source = block.get("metric_source", "top_sqft")
            for member in block.get("members", []):
                pid = member["product_id"]
                prod = all_products.get(pid, {})
                qty = _d(prod.get("quantity", 1))
                if metric_source == "panel_sqft":
                    metric = _d(prod.get("panel_sqft", prod.get("sq_ft_wl", prod.get("sq_ft", 0))))
                elif metric_source == "panel_count":
                    metric = _d(prod.get("panel_count", 0))
                elif metric_source == "sq_ft":
                    metric = _d(prod.get("sq_ft", prod.get("sq_ft_wl", 0)))
                elif metric_source == "top_sqft":
                    metric = _d(prod.get("sq_ft_wl", prod.get("sq_ft", 0)))
                elif metric_source == "bd_ft":
                    metric = _d(prod.get("bd_ft", 0))
                else:
                    metric = _d(prod.get("sq_ft_wl", prod.get("sq_ft", 0)))
                _metric_totals[bid] = _metric_totals.get(bid, Decimal("0")) + metric * qty

    # ── Phase 3: Compute all blocks ──
    # Collect per-product cost/labor results for pricing assembly
    cost_results_by_product: dict[str, list] = {pid: [] for pid in all_products}
    labor_results_by_product: dict[str, list] = {pid: [] for pid in all_products}

    for block in quote_blocks:
        bid = block["id"]
        domain = block.get("block_domain", "cost")
        btype = block.get("block_type", "unit")
        members = block.get("members", [])

        if domain == "cost":
            if btype == "group":
                # Group cost distribution
                member_dicts = [{"product_id": m["product_id"], "id": m.get("id")} for m in members]
                computed = compute_group_cost_block(block, member_dicts, all_products)
                for i, cm in enumerate(computed):
                    members[i]["cost_pp"] = cm["cost_pp"]
                    members[i]["cost_pt"] = cm["cost_pt"]
                    members[i]["metric_value"] = cm["metric_value"]
                    members[i]["hours_pp"] = Decimal("0")
                    members[i]["hours_pt"] = Decimal("0")
                    pid = cm["product_id"]
                    if pid in cost_results_by_product:
                        # Member margin_rate overrides block default
                        m_margin = members[i].get("margin_rate")
                        eff_margin = _d(m_margin if m_margin is not None else block.get("margin_rate", "0.05"))
                        cost_results_by_product[pid].append({
                            "cost_pp": cm["cost_pp"],
                            "cost_pt": cm["cost_pt"],
                            "cost_category": block.get("cost_category", "group_cost"),
                            "tag_id": block.get("tag_id"),
                            "margin_rate": eff_margin,
                        })
            else:
                # Unit cost block — compute per member
                for member in members:
                    pid = member["product_id"]
                    prod = all_products.get(pid, {})
                    result = compute_cost_block(block, member, prod)
                    member["cost_pp"] = result["cost_pp"]
                    member["cost_pt"] = result["cost_pt"]
                    member["hours_pp"] = Decimal("0")
                    member["hours_pt"] = Decimal("0")
                    member["metric_value"] = Decimal("0")
                    if pid in cost_results_by_product:
                        # Member margin_rate overrides block default
                        m_margin = member.get("margin_rate")
                        eff_margin = _d(m_margin if m_margin is not None else block.get("margin_rate", "0.05"))
                        cost_results_by_product[pid].append({
                            "cost_pp": result["cost_pp"],
                            "cost_pt": result["cost_pt"],
                            "cost_category": block.get("cost_category", "unit_cost"),
                            "tag_id": block.get("tag_id"),
                            "margin_rate": eff_margin,
                        })

        elif domain == "labor":
            if btype == "group":
                # Group labor distribution
                member_dicts = [{"product_id": m["product_id"], "id": m.get("id")} for m in members]
                computed = compute_group_labor_block(block, member_dicts, all_products)
                for i, cm in enumerate(computed):
                    members[i]["hours_pp"] = cm["hours_pp"]
                    members[i]["hours_pt"] = cm["hours_pt"]
                    members[i]["metric_value"] = cm["metric_value"]
                    members[i]["cost_pp"] = Decimal("0")
                    members[i]["cost_pt"] = Decimal("0")
                    pid = cm["product_id"]
                    if pid in labor_results_by_product:
                        labor_results_by_product[pid].append({
                            "hours_pp": cm["hours_pp"],
                            "hours_pt": cm["hours_pt"],
                            "labor_center": block.get("labor_center", "unknown"),
                            "tag_id": block.get("tag_id"),
                        })
            else:
                # Rate or unit labor block — compute per member
                for member in members:
                    pid = member["product_id"]
                    prod = all_products.get(pid, {})
                    if block.get("rate_type") == "units":
                        result = compute_labor_block(
                            block, member, prod,
                            all_products_metric_total=_units_metric_totals.get(bid),
                            all_products_qty_total=_units_qty_totals.get(bid),
                        )
                    else:
                        result = compute_labor_block(
                            block, member, prod,
                            all_products_metric_total=_metric_totals.get(bid),
                        )
                    member["hours_pp"] = result["hours_pp"]
                    member["hours_pt"] = result["hours_pt"]
                    member["cost_pp"] = Decimal("0")
                    member["cost_pt"] = Decimal("0")
                    member["metric_value"] = Decimal("0")
                    if pid in labor_results_by_product:
                        labor_results_by_product[pid].append({
                            "hours_pp": result["hours_pp"],
                            "hours_pt": result["hours_pt"],
                            "labor_center": block.get("labor_center", "unknown"),
                            "tag_id": block.get("tag_id"),
                        })

    # ── Phase 4: Assemble product pricing ──
    option_results = []
    for option in options:
        product_results = []
        for product in option.get("products", []):
            pid = product["id"]

            pricing = compute_product_pricing(
                product=product,
                cost_results=cost_results_by_product.get(pid, []),
                labor_results=labor_results_by_product.get(pid, []),
                quote=quote,
            )
            product.update(pricing)

            # Tag summary for this product
            product["tag_summary"] = compute_tag_summary(
                cost_results=cost_results_by_product.get(pid, []),
                labor_results=labor_results_by_product.get(pid, []),
                tags=tags,
            )

            product_results.append(product)

        # Option totals
        opt_totals = compute_option_totals(product_results)
        option.update(opt_totals)
        option_results.append(opt_totals)

    # ── Phase 5: Quote totals ──
    shipping = _d(quote.get("shipping", 0))
    quote_totals = compute_quote_totals(option_results, shipping)
    quote.update(quote_totals)

    return quote_data
