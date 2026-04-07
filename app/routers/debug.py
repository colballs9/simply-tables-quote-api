"""
Debug router — returns detailed calculation trace for a single product.

GET /api/products/{product_id}/debug

Shows every number with the formula that produced it, so Colin can trace
calculations without reading code — like clicking a cell in Sheets to see
the formula.
"""

import uuid
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Product, QuoteOption
from ..services.quote_service import load_full_quote, quote_to_engine_format, load_tags

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))
from calc_engine import compute_quote, MARGIN_CATEGORY_MAP

router = APIRouter(tags=["debug"])


def _f2(v) -> float:
    """Round to 2 decimal places for display."""
    return round(float(v or 0), 2)


def _f3(v) -> float:
    """Round to 3 decimal places for display."""
    return round(float(v or 0), 3)


def _f4(v) -> float:
    """Round to 4 decimal places for display."""
    return round(float(v or 0), 4)


@router.get("/products/{product_id}/debug")
async def debug_product(product_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Return a full calculation trace for a single product.
    Loads the parent quote, runs the engine without saving, and formats
    every computed value with the formula string that produced it.
    """
    # Resolve product → option → quote
    product_orm = await db.get(Product, product_id)
    if not product_orm:
        raise HTTPException(404, "Product not found")

    option_orm = await db.get(QuoteOption, product_orm.option_id)
    if not option_orm:
        raise HTTPException(404, "Option not found")

    # Load and compute (no save)
    quote_orm = await load_full_quote(db, option_orm.quote_id)
    tags = await load_tags(db)
    engine_input = quote_to_engine_format(quote_orm, tags)
    engine_result = compute_quote(engine_input)

    # Find this product in the computed result
    pid = str(product_id)
    product_data = None
    for option in engine_result["options"]:
        for p in option["products"]:
            if p["id"] == pid:
                product_data = p
                break
        if product_data:
            break

    if not product_data:
        raise HTTPException(500, "Product not found in engine result")

    qty = int(product_data.get("quantity", 1))
    bases_per_top = int(product_data.get("bases_per_top", 1))

    w = float(product_data.get("width") or 0)
    l = float(product_data.get("length") or 0)
    shape = product_data.get("shape", "Standard")
    thickness_str = product_data.get("lumber_thickness") or ""
    raw_thickness = _f3(product_data.get("raw_thickness", 0))
    bd_ft = _f3(product_data.get("bd_ft", 0))
    sq_ft = _f3(product_data.get("sq_ft", 0))        # DIA-adjusted (material cost)
    sq_ft_wl = _f3(product_data.get("sq_ft_wl", sq_ft))  # W×L (pools + rate labor)
    quarter_code = product_data.get("quarter_code") or ""

    # ── Dimensions ──────────────────────────────────────────────────────
    if shape == "DIA":
        sq_ft_formula = f"π × ({w}/24)² = {sq_ft}"
    else:
        sq_ft_formula = f"({w}/12) × ({l}/12) = {sq_ft_wl}"

    dimensions = {
        "width": w,
        "length": l,
        "shape": shape,
        "shape_custom": product_data.get("shape_custom"),
        "lumber_thickness": thickness_str or None,
        "raw_thickness": raw_thickness,
        "raw_thickness_source": (
            f"THICKNESS_LOOKUP['{thickness_str}'] = {raw_thickness}"
            if thickness_str else None
        ),
        "quarter_code": quarter_code or None,
        "sq_ft": sq_ft_wl,
        "sq_ft_formula": sq_ft_formula,
        "bd_ft": bd_ft,
        "bd_ft_formula": (
            f"({w} × {l} × {raw_thickness} / 144) × 1.3 = {bd_ft}"
            if bd_ft else None
        ),
    }
    if shape == "DIA":
        dimensions["sq_ft_dia"] = sq_ft
        dimensions["sq_ft_dia_note"] = (
            f"DIA-adjusted area used for per-sqft material cost blocks. "
            f"W×L ({sq_ft_wl}) used for group pools and rate labor."
        )

    # ── Unit cost blocks ─────────────────────────────────────────────────
    cost_blocks_debug = []
    for block in product_data.get("cost_blocks", []):
        cat = block.get("cost_category", "")
        cpu = _f4(block.get("cost_per_unit") or 0)
        mult_type = block.get("multiplier_type", "fixed")
        cost_pp = _f2(block.get("cost_pp", 0))

        if mult_type == "per_bdft":
            formula = f"{cpu} × {bd_ft} bdft = {cost_pp}"
            inputs = {"cost_per_bdft": cpu, "bd_ft": bd_ft}
        elif mult_type == "per_sqft":
            formula = f"{cpu} × {sq_ft} sqft = {cost_pp}"
            inputs = {"cost_per_sqft": cpu, "sq_ft": sq_ft}
        elif mult_type == "per_base":
            formula = f"{cpu} × {bases_per_top} bases = {cost_pp}"
            inputs = {"cost_per_base": cpu, "bases_per_top": bases_per_top}
        else:  # fixed / units_per_product
            units_pp = _f4(block.get("units_per_product") or 1)
            formula = f"{cpu} × {units_pp} = {cost_pp}"
            inputs = {"cost_per_unit": cpu, "units_per_product": units_pp}

        margin_field = MARGIN_CATEGORY_MAP.get(cat, "unit_cost_margin_rate")
        margin_rate = _f4(product_data.get(margin_field) or 0.05)
        margin_pp = _f2(cost_pp * margin_rate)

        cost_blocks_debug.append({
            "id": block.get("id"),
            "description": block.get("description"),
            "category": cat,
            "multiplier_type": mult_type,
            "is_builtin": block.get("is_builtin", False),
            "inputs": inputs,
            "formula": formula,
            "cost_pp": cost_pp,
            "margin_rate": margin_rate,
            "margin_pp": margin_pp,
            "cost_with_margin": _f2(cost_pp + margin_pp),
        })

    # ── Group cost pool shares ────────────────────────────────────────────
    group_pool_shares_debug = []
    for pool in engine_result["group_cost_pools"]:
        member_data = next(
            (m for m in pool["members"] if m["product_id"] == pid), None
        )
        if not member_data:
            continue

        dist_type = pool.get("distribution_type", "units")
        total_amount = _f2(pool.get("total_amount", 0))
        metric_value = _f3(member_data.get("metric_value", 0))
        cost_pp_val = _f2(member_data.get("cost_pp", 0))

        total_metric = _f3(
            sum(float(m.get("metric_value") or 0) for m in pool["members"])
        )
        rate = _f4(total_amount / total_metric if total_metric else 0)

        if dist_type == "sqft":
            metric_formula = f"{sq_ft_wl} sqft × {qty} qty = {metric_value}"
        elif dist_type == "bdft":
            metric_formula = f"{bd_ft} bdft × {qty} qty = {metric_value}"
        else:
            metric_formula = f"{qty} units"

        group_pool_shares_debug.append({
            "pool_id": pool.get("id"),
            "pool_description": pool.get("description"),
            "cost_category": pool.get("cost_category"),
            "pool_total": total_amount,
            "distribution_type": dist_type,
            "this_product_metric": metric_value,
            "this_product_metric_formula": metric_formula,
            "total_metric_all_members": total_metric,
            "rate": rate,
            "rate_formula": f"{total_amount} / {total_metric} = {rate}",
            "cost_pp": cost_pp_val,
            "cost_pp_formula": f"({metric_value} / {qty}) × {rate} = {cost_pp_val}",
        })

    # ── Labor blocks ─────────────────────────────────────────────────────
    labor_blocks_debug = []
    for block in product_data.get("labor_blocks", []):
        block_type = block.get("block_type", "unit")
        hours_pp = _f3(block.get("hours_pp", 0))

        if block_type == "unit":
            hours_pu = _f3(block.get("hours_per_unit") or 0)
            formula = f"{hours_pu} hrs/unit = {hours_pp} hrs PP"
            inputs = {"hours_per_unit": hours_pu}
        elif block_type == "rate":
            rate_value = _f4(block.get("rate_value") or 0)
            metric_source = block.get("metric_source", "top_sqft")
            if metric_source in ("top_sqft", "panel_sqft"):
                metric = sq_ft_wl
                metric_label = "sqft"
            elif metric_source == "bd_ft":
                metric = bd_ft
                metric_label = "bdft"
            else:
                metric = sq_ft_wl
                metric_label = "sqft"
            formula = f"{metric} {metric_label} / {rate_value} {metric_label}/hr = {hours_pp} hrs PP"
            inputs = {metric_label: metric, "rate_per_hr": rate_value}
        else:
            formula = "group type — see group_labor_pool_shares"
            inputs = {}

        labor_blocks_debug.append({
            "id": block.get("id"),
            "labor_center": block.get("labor_center"),
            "description": block.get("description"),
            "block_type": block_type,
            "is_builtin": block.get("is_builtin", False),
            "inputs": inputs,
            "formula": formula,
            "hours_pp": hours_pp,
        })

    # ── Group labor pool shares ───────────────────────────────────────────
    group_labor_shares_debug = []
    for pool in engine_result["group_labor_pools"]:
        member_data = next(
            (m for m in pool["members"] if m["product_id"] == pid), None
        )
        if not member_data:
            continue

        dist_type = pool.get("distribution_type", "units")
        total_hours_pool = _f3(pool.get("total_hours", 0))
        metric_value = _f3(member_data.get("metric_value", 0))
        hours_pp_val = _f3(member_data.get("hours_pp", 0))
        total_metric = _f3(
            sum(float(m.get("metric_value") or 0) for m in pool["members"])
        )
        rate = _f4(total_hours_pool / total_metric if total_metric else 0)

        if dist_type == "sqft":
            metric_formula = f"{sq_ft_wl} sqft × {qty} qty = {metric_value}"
        elif dist_type == "bdft":
            metric_formula = f"{bd_ft} bdft × {qty} qty = {metric_value}"
        else:
            metric_formula = f"{qty} units"

        group_labor_shares_debug.append({
            "pool_id": pool.get("id"),
            "labor_center": pool.get("labor_center"),
            "pool_total_hours": total_hours_pool,
            "distribution_type": dist_type,
            "this_product_metric": metric_value,
            "this_product_metric_formula": metric_formula,
            "total_metric_all_members": total_metric,
            "rate": rate,
            "hours_pp": hours_pp_val,
            "hours_pp_formula": f"({metric_value} / {qty}) × {rate} = {hours_pp_val}",
        })

    # ── Pricing assembly ──────────────────────────────────────────────────
    margin_detail_raw = product_data.get("margin_detail", {})
    margin_detail_debug = {
        cat: {
            "cost":   _f2(detail.get("cost_pp", 0)),
            "rate":   _f4(detail.get("margin_rate", 0)),
            "margin": _f2(detail.get("margin_pp", 0)),
            "price":  _f2(detail.get("price_pp", 0)),
        }
        for cat, detail in margin_detail_raw.items()
    }

    total_mat_cost = _f2(product_data.get("total_material_cost", 0))
    total_mat_margin = _f2(product_data.get("total_material_margin", 0) or 0)
    mat_price = _f2(product_data.get("total_material_price", 0))
    total_hours_pp = _f3(product_data.get("total_hours_pp", 0))
    hourly_rate = _f2(product_data.get("hourly_rate", 155))
    hours_price = _f2(product_data.get("hours_price", 0))
    price_pp = _f2(product_data.get("price_pp", 0))
    adj_rate = _f4(product_data.get("final_adjustment_rate", 1))
    final_price = _f2(product_data.get("final_price_pp", 0))
    rep_rate = _f4(engine_result["quote"].get("rep_rate", 0.08))
    sale_price = _f2(product_data.get("sale_price_pp", 0))
    sale_total = _f2(product_data.get("sale_price_total", 0))

    pricing_assembly = {
        "total_material_cost_pp": total_mat_cost,
        "margin_detail": margin_detail_debug,
        "total_margin_pp": total_mat_margin,
        "material_price_pp": mat_price,
        "material_price_formula": f"{total_mat_cost} cost + {total_mat_margin} margin = {mat_price}",
        "total_hours_pp": total_hours_pp,
        "hourly_rate": hourly_rate,
        "hours_price_pp": hours_price,
        "hours_price_formula": f"{total_hours_pp} hrs × ${hourly_rate}/hr = {hours_price}",
        "price_pp": price_pp,
        "price_formula": f"{mat_price} + {hours_price} = {price_pp}",
        "final_adjustment_rate": adj_rate,
        "final_price_pp": final_price,
        "rep_rate": rep_rate,
        "sale_price_pp": sale_price,
        "sale_price_formula": f"{final_price} × (1 + {rep_rate}) = {sale_price}",
        "sale_price_total": sale_total,
        "sale_total_formula": f"{sale_price} × {qty} qty = {sale_total}",
    }

    return {
        "product_id": pid,
        "title": product_data.get("title"),
        "quantity": qty,
        "dimensions": dimensions,
        "cost_blocks": cost_blocks_debug,
        "group_pool_shares": group_pool_shares_debug,
        "labor_blocks": labor_blocks_debug,
        "group_labor_pool_shares": group_labor_shares_debug,
        "pricing_assembly": pricing_assembly,
    }
