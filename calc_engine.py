"""
Simply Tables — Calculation Engine V1

Pure-function engine that computes all derived values for quotes.
No database calls — receives data dicts, returns computed results.

Mirrors the Pricing Sheet V5 aggregation hierarchy:
    PU/PB → PP → PT → Option Total → Quote Total

Three block patterns:
    Unit Block:  value × multiplier → PP
    Group Block: lump sum ÷ proportional → PP
    Rate Block:  metric ÷ rate → proportional hours
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

# Margin rate field name → cost_category mapping
# Determines which margin rate applies to each cost category
MARGIN_CATEGORY_MAP: dict[str, str] = {
    "species":              "hardwood_margin_rate",
    "stone":                "stone_margin_rate",
    "stock_base":           "stock_base_margin_rate",
    "stock_base_shipping":  "stock_base_ship_margin_rate",
    "powder_coat":          "powder_coat_margin_rate",
    "unit_cost_base":       "custom_base_margin_rate",
    "custom_base":          "custom_base_margin_rate",
    "unit_cost":            "unit_cost_margin_rate",
    "group_cost":           "group_cost_margin_rate",
    "group_cost_base":      "group_cost_margin_rate",
    "misc":                 "misc_margin_rate",
    "consumables":          "consumables_margin_rate",
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
    
    Returns dict with: sq_ft, bd_ft, raw_thickness, quarter_code
    
    Sheet formulas:
        Row 55: SqFt = (Width/12) × (Length/12)
        Row 56: SqFt if DIA = π × (Width/24)²
        Row 54: BdFt = (Width × Length × RawThickness / 144) × 1.3
    """
    width = _d(product.get("width"))
    length = _d(product.get("length"))
    shape = product.get("shape", "Standard")
    thickness_str = product.get("lumber_thickness", "")
    material_type = product.get("material_type", "")

    # Square footage
    if shape == "DIA":
        # Circular: π × (diameter/24)² — diameter is in the width field
        radius_ft = width / Decimal("24")
        sq_ft = _round4(Decimal(str(math.pi)) * radius_ft * radius_ft)
    elif width > 0 and length > 0:
        sq_ft = _round4((width / Decimal("12")) * (length / Decimal("12")))
    else:
        sq_ft = Decimal("0")

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
# 2. Unit Cost Block
# ──────────────────────────────────────────────────────────────────────

def compute_cost_block(block: dict, product: dict) -> dict:
    """
    Compute a unit cost block: cost_per_unit × multiplier → PP → PT.
    
    multiplier_type determines what units_per_product resolves to:
        'fixed'    → use the stored value as-is
        'per_base' → bases_per_top
        'per_sqft' → sq_ft
        'per_bdft' → bd_ft
    
    Sheet pattern (Unit Block):
        PP = CostPU × Multiplier
        PT = PP × Quantity
    """
    cost_per_unit = _d(block.get("cost_per_unit"))
    multiplier_type = block.get("multiplier_type", "fixed")
    quantity = _d(product.get("quantity", 1))

    # Resolve the multiplier
    if multiplier_type == "per_base":
        multiplier = _d(product.get("bases_per_top", 1))
    elif multiplier_type == "per_sqft":
        multiplier = _d(product.get("sq_ft", 0))
    elif multiplier_type == "per_bdft":
        multiplier = _d(product.get("bd_ft", 0))
    else:
        multiplier = _d(block.get("units_per_product", 1))

    cost_pp = _round4(cost_per_unit * multiplier)
    cost_pt = _round4(cost_pp * quantity)

    return {
        "cost_pp": cost_pp,
        "cost_pt": cost_pt,
    }


# ──────────────────────────────────────────────────────────────────────
# 3. Group Cost Pool
# ──────────────────────────────────────────────────────────────────────

def compute_group_cost_pool(pool: dict, members: list[dict], products: dict[str, dict]) -> list[dict]:
    """
    Distribute a lump-sum cost across participating products proportionally.
    
    pool: the group_cost_pool record
    members: list of pool_member records (each has product_id)
    products: dict of product_id → product data (must include sq_ft, bd_ft, quantity)
    
    Returns: list of updated member dicts with metric_value, cost_pp, cost_pt
    
    Sheet pattern (Group Block):
        metric_value = product's contribution (qty, sqft*qty, bdft*qty)
        rate = total_amount / sum(all metric_values)
        cost_pp = metric_value / quantity × rate
        cost_pt = cost_pp × quantity
    """
    total_amount = _d(pool.get("total_amount", 0))
    dist_type = pool.get("distribution_type", "units")

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
            metric = _d(prod.get("sq_ft", 0)) * qty
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
# 4. Labor Blocks
# ──────────────────────────────────────────────────────────────────────

def compute_labor_block(block: dict, product: dict, all_products_metric_total: Optional[Decimal] = None) -> dict:
    """
    Compute a labor block's hours.
    
    block_type determines the calculation:
    
    'unit': Direct hours input.
        hours_pp = hours_per_unit
        hours_pt = hours_pp × quantity
        
    'rate': Proportional hours from a rate (sqft/hr, panels/hr).
        total_hours = total_metric / rate_value
        hours_pp = (product_metric / total_metric) × total_hours / quantity
        
        NOTE: Rate blocks need total metric across ALL products to distribute
        proportionally (same as Tier 1 LCs: LC101, LC102). Pass 
        all_products_metric_total for cross-product distribution.
        For single-product rate blocks, it simplifies to metric / rate.
        
    'group': Handled by group_labor_pools (same pattern as group cost pools)
    """
    block_type = block.get("block_type", "unit")
    quantity = _d(product.get("quantity", 1))
    is_active = block.get("is_active", True)

    if not is_active:
        return {"hours_pp": Decimal("0"), "hours_pt": Decimal("0")}

    if block_type == "unit":
        hours_pu = _d(block.get("hours_per_unit", 0))
        hours_pp = hours_pu
        hours_pt = _round4(hours_pp * quantity)
        return {"hours_pp": _round4(hours_pp), "hours_pt": hours_pt}

    elif block_type == "rate":
        rate_value = _d(block.get("rate_value", 0))
        metric_source = block.get("metric_source", "top_sqft")

        # Resolve this product's metric
        if metric_source == "panel_sqft":
            product_metric = _d(product.get("panel_sqft", product.get("sq_ft", 0)))
        elif metric_source == "top_sqft":
            product_metric = _d(product.get("sq_ft", 0))
        elif metric_source == "bd_ft":
            product_metric = _d(product.get("bd_ft", 0))
        else:
            product_metric = _d(product.get("sq_ft", 0))

        if rate_value == 0 or product_metric == 0:
            return {"hours_pp": Decimal("0"), "hours_pt": Decimal("0")}

        # Single-product simplified: hours = metric / rate
        # Multi-product proportional: hours = (product_metric / total_metric) × (total_metric / rate) / qty
        if all_products_metric_total and all_products_metric_total > 0:
            total_hours = all_products_metric_total / rate_value
            product_metric_pt = product_metric * quantity
            hours_pp = _round4((product_metric_pt / all_products_metric_total) * total_hours / quantity)
        else:
            hours_pp = _round4(product_metric / rate_value)

        hours_pt = _round4(hours_pp * quantity)
        return {"hours_pp": hours_pp, "hours_pt": hours_pt}

    # Group type handled by group_labor_pools
    return {"hours_pp": Decimal("0"), "hours_pt": Decimal("0")}


def compute_group_labor_pool(pool: dict, members: list[dict], products: dict[str, dict]) -> list[dict]:
    """
    Distribute lump-sum hours across participating products.
    Same pattern as group cost pools but for hours.
    """
    total_hours = _d(pool.get("total_hours", 0))
    dist_type = pool.get("distribution_type", "units")

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
            metric = _d(prod.get("sq_ft", 0)) * qty
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
            r["hours_pp"] = _round4(r["metric_value"] / qty * rate)
            r["hours_pt"] = _round4(r["hours_pp"] * qty)
        else:
            r["hours_pp"] = Decimal("0")
            r["hours_pt"] = Decimal("0")

    return results


# ──────────────────────────────────────────────────────────────────────
# 5. Product Pricing Assembly
# ──────────────────────────────────────────────────────────────────────

def compute_product_pricing(
    product: dict,
    cost_blocks: list[dict],
    group_cost_shares: list[dict],
    labor_blocks: list[dict],
    group_labor_shares: list[dict],
    quote: dict,
) -> dict:
    """
    Assemble final pricing for a single product.
    
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

    # ── Step 1: Aggregate costs by category ──
    category_costs: dict[str, Decimal] = {}

    for block in cost_blocks:
        cat = block.get("cost_category", "other")
        category_costs[cat] = category_costs.get(cat, Decimal("0")) + _d(block.get("cost_pp", 0))

    for share in group_cost_shares:
        # Group shares carry their pool's category
        cat = share.get("cost_category", "group_cost")
        category_costs[cat] = category_costs.get(cat, Decimal("0")) + _d(share.get("cost_pp", 0))

    # ── Step 2: Apply margins per category ──
    total_cost_pp = Decimal("0")
    total_margin_pp = Decimal("0")
    total_material_price_pp = Decimal("0")
    margin_detail = {}

    for cat, cost_pp in category_costs.items():
        margin_field = MARGIN_CATEGORY_MAP.get(cat, "unit_cost_margin_rate")
        margin_rate = _d(product.get(margin_field, "0.05"))

        cost_with_margin = _round4(cost_pp * (Decimal("1") + margin_rate))
        margin_dollars = cost_with_margin - cost_pp

        total_cost_pp += cost_pp
        total_margin_pp += margin_dollars
        total_material_price_pp += cost_with_margin

        margin_detail[cat] = {
            "cost_pp": cost_pp,
            "margin_rate": margin_rate,
            "margin_pp": margin_dollars,
            "price_pp": cost_with_margin,
        }

    # ── Step 3: Aggregate hours ──
    total_hours_pp = Decimal("0")
    hours_by_lc: dict[str, Decimal] = {}

    for block in labor_blocks:
        lc = block.get("labor_center", "unknown")
        hrs = _d(block.get("hours_pp", 0))
        total_hours_pp += hrs
        hours_by_lc[lc] = hours_by_lc.get(lc, Decimal("0")) + hrs

    for share in group_labor_shares:
        lc = share.get("labor_center", "unknown")
        hrs = _d(share.get("hours_pp", 0))
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
# 6. Tag Summary
# ──────────────────────────────────────────────────────────────────────

def compute_tag_summary(
    cost_blocks: list[dict],
    labor_blocks: list[dict],
    group_cost_shares: list[dict],
    group_labor_shares: list[dict],
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

    for b in cost_blocks:
        _add(b.get("tag_id"), cost_pp=b.get("cost_pp"), cost_pt=b.get("cost_pt"))
    for s in group_cost_shares:
        _add(s.get("tag_id"), cost_pp=s.get("cost_pp"), cost_pt=s.get("cost_pt"))
    for b in labor_blocks:
        _add(b.get("tag_id"), hours_pp=b.get("hours_pp"), hours_pt=b.get("hours_pt"))
    for s in group_labor_shares:
        _add(s.get("tag_id"), hours_pp=s.get("hours_pp"), hours_pt=s.get("hours_pt"))

    return summary


# ──────────────────────────────────────────────────────────────────────
# 7. Option & Quote Totals
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


def compute_quote_totals(option_results: list[dict]) -> dict:
    """
    Roll up option totals to quote level.
    For single-option quotes this is just a pass-through.
    For multi-option quotes, each option has independent totals —
    the quote total reflects the primary/selected option.
    """
    # For now, sum all options (single-option case)
    # Future: allow selecting which option is the "active" one
    total_cost = sum(_d(o.get("total_cost", 0)) for o in option_results)
    total_price = sum(_d(o.get("total_price", 0)) for o in option_results)
    total_hours = sum(_d(o.get("total_hours", 0)) for o in option_results)

    return {
        "total_cost": _round2(total_cost),
        "total_price": _round2(total_price),
        "total_hours": _round4(total_hours),
    }


# ──────────────────────────────────────────────────────────────────────
# 8. Full Quote Computation (Orchestrator)
# ──────────────────────────────────────────────────────────────────────

def compute_quote(quote_data: dict) -> dict:
    """
    Top-level orchestrator. Takes a full quote data structure and computes
    every derived value.
    
    Expected input structure:
    {
        "quote": { id, project_name, has_rep, rep_rate, status, ... },
        "tags": { tag_id: tag_name, ... },
        "options": [
            {
                "id": ...,
                "name": "Standard",
                "products": [
                    {
                        "id": ..., "quantity": 2, "width": 36, "length": 48, ...
                        "cost_blocks": [ { cost_per_unit, multiplier_type, ... }, ... ],
                        "labor_blocks": [ { block_type, labor_center, ... }, ... ],
                    },
                    ...
                ],
            },
            ...
        ],
        "group_cost_pools": [
            { "total_amount": 300, "distribution_type": "units", "members": [...], ... },
            ...
        ],
        "group_labor_pools": [ ... ],
    }
    
    Returns the same structure with all computed fields populated.
    """
    quote = quote_data.get("quote", {})
    tags = quote_data.get("tags", {})
    options = quote_data.get("options", [])
    group_cost_pools = quote_data.get("group_cost_pools", [])
    group_labor_pools = quote_data.get("group_labor_pools", [])

    # Build product lookup for group pool distribution
    all_products: dict[str, dict] = {}
    for option in options:
        for product in option.get("products", []):
            all_products[product["id"]] = product

    # ── Phase 1: Compute dimensions for all products ──
    for pid, product in all_products.items():
        dims = compute_dimensions(product)
        product.update(dims)
        product["dimension_string"] = compute_dimension_string(product)

    # ── Phase 2: Compute unit cost blocks ──
    for pid, product in all_products.items():
        for block in product.get("cost_blocks", []):
            result = compute_cost_block(block, product)
            block.update(result)

    # ── Phase 3: Compute group cost pools ──
    group_cost_shares_by_product: dict[str, list] = {pid: [] for pid in all_products}

    for pool in group_cost_pools:
        members = pool.get("members", [])
        products_for_pool = {
            m["product_id"]: all_products[m["product_id"]]
            for m in members
            if m["product_id"] in all_products
        }
        computed_members = compute_group_cost_pool(pool, members, products_for_pool)

        for cm in computed_members:
            pid = cm["product_id"]
            # Attach pool-level info for pricing assembly
            cm["cost_category"] = pool.get("cost_category", "group_cost")
            cm["tag_id"] = pool.get("tag_id")
            if pid in group_cost_shares_by_product:
                group_cost_shares_by_product[pid].append(cm)

        pool["members"] = computed_members

    # ── Phase 4: Compute labor blocks ──
    for pid, product in all_products.items():
        for block in product.get("labor_blocks", []):
            if block.get("block_type") != "group":
                result = compute_labor_block(block, product)
                block.update(result)

    # ── Phase 5: Compute group labor pools ──
    group_labor_shares_by_product: dict[str, list] = {pid: [] for pid in all_products}

    for pool in group_labor_pools:
        members = pool.get("members", [])
        products_for_pool = {
            m["product_id"]: all_products[m["product_id"]]
            for m in members
            if m["product_id"] in all_products
        }
        computed_members = compute_group_labor_pool(pool, members, products_for_pool)

        for cm in computed_members:
            pid = cm["product_id"]
            cm["labor_center"] = pool.get("labor_center", "unknown")
            cm["tag_id"] = pool.get("tag_id")
            if pid in group_labor_shares_by_product:
                group_labor_shares_by_product[pid].append(cm)

        pool["members"] = computed_members

    # ── Phase 6: Assemble product pricing ──
    option_results = []
    for option in options:
        product_results = []
        for product in option.get("products", []):
            pid = product["id"]

            pricing = compute_product_pricing(
                product=product,
                cost_blocks=product.get("cost_blocks", []),
                group_cost_shares=group_cost_shares_by_product.get(pid, []),
                labor_blocks=product.get("labor_blocks", []),
                group_labor_shares=group_labor_shares_by_product.get(pid, []),
                quote=quote,
            )
            product.update(pricing)

            # Tag summary for this product
            product["tag_summary"] = compute_tag_summary(
                cost_blocks=product.get("cost_blocks", []),
                labor_blocks=product.get("labor_blocks", []),
                group_cost_shares=group_cost_shares_by_product.get(pid, []),
                group_labor_shares=group_labor_shares_by_product.get(pid, []),
                tags=tags,
            )

            product_results.append(product)

        # Option totals
        opt_totals = compute_option_totals(product_results)
        option.update(opt_totals)
        option_results.append(opt_totals)

    # ── Phase 7: Quote totals ──
    quote_totals = compute_quote_totals(option_results)
    quote.update(quote_totals)

    return quote_data
