"""
Quote job summary router.

Aggregates all computed block values into a single side-panel-ready structure:
costs by category, tagged sub-lines, labor hours by center, and op metrics.
All values come from the already-computed (stored) fields — no engine re-run needed.
"""

import uuid
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas import QuoteJobSummary, TagLineSummary
from ..services.quote_service import load_full_quote, load_tags

router = APIRouter(tags=["summary"])

# Category → cost group mapping
_MATERIAL_CATS = {"species", "stone", "hardwood_base"}
_BASE_CATS = {"stock_base", "stock_base_shipping", "powder_coat", "custom_base", "unit_cost_base"}
# Everything else → other


def _d(v) -> Decimal:
    return Decimal(str(v)) if v is not None else Decimal("0")


@router.get("/quotes/{quote_id}/summary", response_model=QuoteJobSummary)
async def get_quote_summary(
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Return aggregated cost/labor summary for the quote side panel.

    Reads stored computed values from cost_blocks, labor_blocks, and pool members —
    no recalculation triggered.
    """
    quote = await load_full_quote(db, quote_id)
    if not quote:
        raise HTTPException(404, "Quote not found")

    tags = await load_tags(db)   # {id_str: name}

    # ── Aggregate across all options → products → blocks ────────────────
    cost_by_category: dict[str, Decimal] = {}
    cost_by_tag: dict[str, Decimal] = {}
    hours_by_tag: dict[str, Decimal] = {}
    hours_by_lc: dict[str, Decimal] = {}
    total_margin = Decimal("0")
    total_material_price = Decimal("0")
    hours_price_total = Decimal("0")

    for option in quote.options:
        for product in option.products:
            hourly_rate = _d(product.hourly_rate or 155)

            for cb in product.cost_blocks:
                cat = cb.cost_category or "other"
                cost_pt = _d(cb.cost_pt)
                cost_by_category[cat] = cost_by_category.get(cat, Decimal("0")) + cost_pt

                if cb.tag_id:
                    tag_name = tags.get(str(cb.tag_id), "Untagged")
                    cost_by_tag[tag_name] = cost_by_tag.get(tag_name, Decimal("0")) + cost_pt

            for lb in product.labor_blocks:
                lc = lb.labor_center or "unknown"
                hours_pt = _d(lb.hours_pt)
                hours_by_lc[lc] = hours_by_lc.get(lc, Decimal("0")) + hours_pt

                if lb.tag_id:
                    tag_name = tags.get(str(lb.tag_id), "Untagged")
                    hours_by_tag[tag_name] = hours_by_tag.get(tag_name, Decimal("0")) + hours_pt

            # Accumulate margin and price from stored product-level computed values
            qty = _d(product.quantity or 1)
            if product.total_material_margin is not None:
                total_margin += _d(product.total_material_margin) * qty
            if product.total_material_price is not None:
                total_material_price += _d(product.total_material_price) * qty
            if product.hours_price is not None:
                hours_price_total += _d(product.hours_price) * qty

    # Group pool members
    for pool in quote.group_cost_pools:
        cat = pool.cost_category or "group_cost"
        tag_id = str(pool.tag_id) if pool.tag_id else None
        tag_name = tags.get(tag_id, "Untagged") if tag_id else None

        for m in pool.members:
            cost_pt = _d(m.cost_pt)
            cost_by_category[cat] = cost_by_category.get(cat, Decimal("0")) + cost_pt
            if tag_name:
                cost_by_tag[tag_name] = cost_by_tag.get(tag_name, Decimal("0")) + cost_pt

    for pool in quote.group_labor_pools:
        lc = pool.labor_center or "unknown"
        tag_id = str(pool.tag_id) if pool.tag_id else None
        tag_name = tags.get(tag_id, "Untagged") if tag_id else None

        for m in pool.members:
            hours_pt = _d(m.hours_pt)
            hours_by_lc[lc] = hours_by_lc.get(lc, Decimal("0")) + hours_pt
            if tag_name:
                hours_by_tag[tag_name] = hours_by_tag.get(tag_name, Decimal("0")) + hours_pt

    # ── Three cost group totals ──────────────────────────────────────────
    material_total = sum(
        v for k, v in cost_by_category.items() if k in _MATERIAL_CATS
    )
    base_total = sum(
        v for k, v in cost_by_category.items() if k in _BASE_CATS
    )
    other_total = sum(
        v for k, v in cost_by_category.items()
        if k not in _MATERIAL_CATS and k not in _BASE_CATS
    )

    # ── Op metrics ──────────────────────────────────────────────────────
    total_cost = _d(quote.total_cost)
    quote_total = _d(quote.total_price)
    total_hours = _d(quote.total_hours)
    shipping = _d(quote.shipping)
    grand_total = _d(quote.grand_total)

    op_revenue = quote_total - total_cost if quote_total else None
    job_dph = None
    if op_revenue and total_hours and total_hours > 0:
        job_dph = float(op_revenue / total_hours)

    # ── Build tag summary ────────────────────────────────────────────────
    all_tag_names = set(cost_by_tag) | set(hours_by_tag)
    cost_by_tag_summary = {
        name: TagLineSummary(
            cost_pt=float(cost_by_tag.get(name, Decimal("0"))),
            hours_pt=float(hours_by_tag.get(name, Decimal("0"))),
        )
        for name in all_tag_names
    }

    return QuoteJobSummary(
        quote_id=quote_id,
        cost_by_category={k: float(v) for k, v in cost_by_category.items()},
        material_cost_total=float(material_total),
        base_cost_total=float(base_total),
        other_cost_total=float(other_total),
        cost_by_tag=cost_by_tag_summary,
        hours_by_labor_center={k: float(v) for k, v in hours_by_lc.items()},
        total_cost=float(total_cost) if total_cost else None,
        total_margin=float(total_margin),
        total_material_price=float(total_material_price),
        total_hours=float(total_hours) if total_hours else None,
        hours_price=float(hours_price_total),
        quote_total=float(quote_total) if quote_total else None,
        shipping=float(shipping),
        grand_total=float(grand_total) if grand_total else None,
        op_revenue=float(op_revenue) if op_revenue is not None else None,
        job_dollar_per_hr=job_dph,
    )
