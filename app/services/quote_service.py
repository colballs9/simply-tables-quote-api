"""
Quote Service — business logic layer.

Loads the full quote graph from the database, converts to the dict format
the calc engine expects, runs computation, and writes results back.

This is the single point where the calc engine is invoked.
Every router that modifies inputs calls recalculate_quote() after saving.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import (
    Quote, QuoteOption, Product, CostBlock, LaborBlock,
    GroupCostPool, GroupCostPoolMember,
    GroupLaborPool, GroupLaborPoolMember,
    Tag,
)

# Import the calc engine — lives one directory up
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from calc_engine import compute_quote


async def load_full_quote(db: AsyncSession, quote_id: uuid.UUID) -> Quote | None:
    """
    Eagerly load the entire quote graph in minimal queries.
    Returns the ORM object with all relationships populated.
    """
    stmt = (
        select(Quote)
        .where(Quote.id == quote_id)
        .options(
            selectinload(Quote.options)
                .selectinload(QuoteOption.products)
                .selectinload(Product.cost_blocks),
            selectinload(Quote.options)
                .selectinload(QuoteOption.products)
                .selectinload(Product.labor_blocks),
            selectinload(Quote.group_cost_pools)
                .selectinload(GroupCostPool.members),
            selectinload(Quote.group_labor_pools)
                .selectinload(GroupLaborPool.members),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def load_tags(db: AsyncSession) -> dict[str, str]:
    """Load all tags as {id_str: name} dict for the calc engine."""
    result = await db.execute(select(Tag))
    tags = result.scalars().all()
    return {str(t.id): t.name for t in tags}


def quote_to_engine_format(quote: Quote, tags: dict[str, str]) -> dict:
    """
    Convert ORM objects to the dict format compute_quote() expects.
    """
    options_data = []
    for option in quote.options:
        products_data = []
        for product in option.products:
            cost_blocks_data = []
            for cb in product.cost_blocks:
                cost_blocks_data.append({
                    "id": str(cb.id),
                    "tag_id": str(cb.tag_id) if cb.tag_id else None,
                    "cost_category": cb.cost_category,
                    "description": cb.description,
                    "cost_per_unit": cb.cost_per_unit,
                    "units_per_product": cb.units_per_product,
                    "multiplier_type": cb.multiplier_type,
                })

            labor_blocks_data = []
            for lb in product.labor_blocks:
                labor_blocks_data.append({
                    "id": str(lb.id),
                    "tag_id": str(lb.tag_id) if lb.tag_id else None,
                    "labor_center": lb.labor_center,
                    "block_type": lb.block_type,
                    "description": lb.description,
                    "rate_value": lb.rate_value,
                    "metric_source": lb.metric_source,
                    "is_active": lb.is_active,
                    "hours_per_unit": lb.hours_per_unit,
                })

            products_data.append({
                "id": str(product.id),
                "quantity": product.quantity,
                "width": product.width,
                "length": product.length,
                "shape": product.shape,
                "shape_custom": product.shape_custom,
                "height_name": product.height_name,
                "height_input": product.height_input,
                "material_type": product.material_type,
                "material_detail": product.material_detail,
                "lumber_thickness": product.lumber_thickness,
                "base_type": product.base_type,
                "bases_per_top": product.bases_per_top,
                "hourly_rate": product.hourly_rate,
                "final_adjustment_rate": product.final_adjustment_rate,
                # Margin rates
                "hardwood_margin_rate": product.hardwood_margin_rate,
                "stone_margin_rate": product.stone_margin_rate,
                "stock_base_margin_rate": product.stock_base_margin_rate,
                "stock_base_ship_margin_rate": product.stock_base_ship_margin_rate,
                "powder_coat_margin_rate": product.powder_coat_margin_rate,
                "custom_base_margin_rate": product.custom_base_margin_rate,
                "unit_cost_margin_rate": product.unit_cost_margin_rate,
                "group_cost_margin_rate": product.group_cost_margin_rate,
                "misc_margin_rate": product.misc_margin_rate,
                "consumables_margin_rate": product.consumables_margin_rate,
                # Nested blocks
                "cost_blocks": cost_blocks_data,
                "labor_blocks": labor_blocks_data,
            })

        options_data.append({
            "id": str(option.id),
            "name": option.name,
            "products": products_data,
        })

    group_cost_pools_data = []
    for pool in quote.group_cost_pools:
        group_cost_pools_data.append({
            "id": str(pool.id),
            "tag_id": str(pool.tag_id) if pool.tag_id else None,
            "total_amount": pool.total_amount,
            "distribution_type": pool.distribution_type,
            "cost_category": pool.cost_category,
            "on_qty_change": pool.on_qty_change,
            "members": [
                {"id": str(m.id), "product_id": str(m.product_id)}
                for m in pool.members
            ],
        })

    group_labor_pools_data = []
    for pool in quote.group_labor_pools:
        group_labor_pools_data.append({
            "id": str(pool.id),
            "tag_id": str(pool.tag_id) if pool.tag_id else None,
            "labor_center": pool.labor_center,
            "total_hours": pool.total_hours,
            "distribution_type": pool.distribution_type,
            "on_qty_change": pool.on_qty_change,
            "members": [
                {"id": str(m.id), "product_id": str(m.product_id)}
                for m in pool.members
            ],
        })

    return {
        "quote": {
            "id": str(quote.id),
            "has_rep": quote.has_rep,
            "rep_rate": quote.rep_rate,
        },
        "tags": tags,
        "options": options_data,
        "group_cost_pools": group_cost_pools_data,
        "group_labor_pools": group_labor_pools_data,
    }


def _dec(value) -> float | None:
    """Convert Decimal to float for ORM assignment."""
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return value


async def save_computed_results(db: AsyncSession, quote: Quote, engine_result: dict):
    """
    Write computed values from the calc engine back to ORM objects.
    """
    # Quote totals
    q = engine_result.get("quote", {})
    quote.total_cost = _dec(q.get("total_cost"))
    quote.total_price = _dec(q.get("total_price"))
    quote.total_hours = _dec(q.get("total_hours"))

    # Build lookup maps by string ID
    product_map: dict[str, Product] = {}
    cost_block_map: dict[str, CostBlock] = {}
    labor_block_map: dict[str, LaborBlock] = {}

    for option in quote.options:
        for product in option.products:
            product_map[str(product.id)] = product
            for cb in product.cost_blocks:
                cost_block_map[str(cb.id)] = cb
            for lb in product.labor_blocks:
                labor_block_map[str(lb.id)] = lb

    # Options
    for opt_data in engine_result.get("options", []):
        for orm_opt in quote.options:
            if str(orm_opt.id) == opt_data["id"]:
                orm_opt.total_cost = _dec(opt_data.get("total_cost"))
                orm_opt.total_price = _dec(opt_data.get("total_price"))
                orm_opt.total_hours = _dec(opt_data.get("total_hours"))
                break

        # Products
        for prod_data in opt_data.get("products", []):
            orm_prod = product_map.get(prod_data["id"])
            if not orm_prod:
                continue

            orm_prod.sq_ft = _dec(prod_data.get("sq_ft"))
            orm_prod.bd_ft = _dec(prod_data.get("bd_ft"))
            orm_prod.total_material_cost = _dec(prod_data.get("total_material_cost"))
            orm_prod.total_material_margin = _dec(prod_data.get("total_material_margin"))
            orm_prod.total_material_price = _dec(prod_data.get("total_material_price"))
            orm_prod.total_hours_pp = _dec(prod_data.get("total_hours_pp"))
            orm_prod.hours_price = _dec(prod_data.get("hours_price"))
            orm_prod.price_pp = _dec(prod_data.get("price_pp"))
            orm_prod.final_price_pp = _dec(prod_data.get("final_price_pp"))
            orm_prod.sale_price_pp = _dec(prod_data.get("sale_price_pp"))
            orm_prod.sale_price_total = _dec(prod_data.get("sale_price_total"))

            # Cost blocks
            for cb_data in prod_data.get("cost_blocks", []):
                orm_cb = cost_block_map.get(cb_data.get("id"))
                if orm_cb:
                    orm_cb.cost_pp = _dec(cb_data.get("cost_pp"))
                    orm_cb.cost_pt = _dec(cb_data.get("cost_pt"))

            # Labor blocks
            for lb_data in prod_data.get("labor_blocks", []):
                orm_lb = labor_block_map.get(lb_data.get("id"))
                if orm_lb:
                    orm_lb.hours_pp = _dec(lb_data.get("hours_pp"))
                    orm_lb.hours_pt = _dec(lb_data.get("hours_pt"))

    # Group cost pool members
    pool_member_map: dict[str, GroupCostPoolMember] = {}
    for pool in quote.group_cost_pools:
        for m in pool.members:
            pool_member_map[str(m.id)] = m

    for pool_data in engine_result.get("group_cost_pools", []):
        for m_data in pool_data.get("members", []):
            orm_m = pool_member_map.get(m_data.get("id"))
            if orm_m:
                orm_m.metric_value = _dec(m_data.get("metric_value"))
                orm_m.cost_pp = _dec(m_data.get("cost_pp"))
                orm_m.cost_pt = _dec(m_data.get("cost_pt"))

    # Group labor pool members
    labor_member_map: dict[str, GroupLaborPoolMember] = {}
    for pool in quote.group_labor_pools:
        for m in pool.members:
            labor_member_map[str(m.id)] = m

    for pool_data in engine_result.get("group_labor_pools", []):
        for m_data in pool_data.get("members", []):
            orm_m = labor_member_map.get(m_data.get("id"))
            if orm_m:
                orm_m.metric_value = _dec(m_data.get("metric_value"))
                orm_m.hours_pp = _dec(m_data.get("hours_pp"))
                orm_m.hours_pt = _dec(m_data.get("hours_pt"))

    await db.flush()


async def recalculate_quote(db: AsyncSession, quote_id: uuid.UUID) -> Quote | None:
    """
    The main entry point called after any input change.
    Loads the full quote, runs the engine, saves results, commits.
    """
    quote = await load_full_quote(db, quote_id)
    if not quote:
        return None

    tags = await load_tags(db)
    engine_input = quote_to_engine_format(quote, tags)
    engine_result = compute_quote(engine_input)
    await save_computed_results(db, quote, engine_result)
    await db.commit()

    # Reload to get fresh computed values
    return await load_full_quote(db, quote_id)
