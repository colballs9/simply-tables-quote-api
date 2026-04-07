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
    Tag, SpeciesAssignment, ProductComponent, StoneAssignment,
)

# Import the calc engine — lives one directory up
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from calc_engine import (
    compute_quote,
    THICKNESS_LOOKUP, QUARTER_CODE_LOOKUP, WASTE_FACTOR_TOP,
    COMPONENT_QUARTER_CODE_LOOKUP, WASTE_FACTOR_BASE,
)


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
            selectinload(Quote.options)
                .selectinload(QuoteOption.products)
                .selectinload(Product.components),
            selectinload(Quote.group_cost_pools)
                .selectinload(GroupCostPool.members),
            selectinload(Quote.group_labor_pools)
                .selectinload(GroupLaborPool.members),
            selectinload(Quote.species_assignments),
            selectinload(Quote.stone_assignments),
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
                    "rate_type": lb.rate_type or "metric",
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
                # Components (Material Builder)
                "components": [
                    {
                        "id": str(c.id),
                        "component_type": c.component_type,
                        "description": c.description,
                        "width": c.width,
                        "length": c.length,
                        "thickness": c.thickness,
                        "qty_per_base": c.qty_per_base,
                        "material": c.material,
                    }
                    for c in product.components
                ],
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
            "shipping": quote.shipping or 0,
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
    quote.grand_total = _dec(q.get("grand_total"))

    # Build lookup maps by string ID
    product_map: dict[str, Product] = {}
    cost_block_map: dict[str, CostBlock] = {}
    labor_block_map: dict[str, LaborBlock] = {}
    component_map: dict[str, ProductComponent] = {}

    for option in quote.options:
        for product in option.products:
            product_map[str(product.id)] = product
            for cb in product.cost_blocks:
                cost_block_map[str(cb.id)] = cb
            for lb in product.labor_blocks:
                labor_block_map[str(lb.id)] = lb
            for c in product.components:
                component_map[str(c.id)] = c

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
            orm_prod.panel_sqft = _dec(prod_data.get("panel_sqft"))
            orm_prod.panel_count = prod_data.get("panel_count")
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

            # Components
            for c_data in prod_data.get("components", []):
                orm_c = component_map.get(c_data.get("id"))
                if orm_c:
                    orm_c.bd_ft_per_piece = _dec(c_data.get("bd_ft_per_piece"))
                    orm_c.bd_ft_pp = _dec(c_data.get("bd_ft_pp"))
                    orm_c.sq_ft_per_piece = _dec(c_data.get("sq_ft_per_piece"))
                    orm_c.sq_ft_pp = _dec(c_data.get("sq_ft_pp"))

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


async def manage_species_pipeline(db: AsyncSession, quote: Quote) -> None:
    """
    Ensure species_assignment records and built-in species cost blocks are
    up-to-date for all Hardwood/Live Edge products in the quote.

    Called before compute_quote() in recalculate_quote(). The species blocks
    created here are treated as normal cost blocks by the engine.

    Supports multiple species per product (top + components with different species).
    Each (product, species_key) pair gets its own built-in block with:
      multiplier_type = "per_unit", units_per_product = total_bd_ft_pp for that species,
      cost_per_unit = price_per_bdft → cost_pp = price × bdft.

    Flow:
      1. Scan products + components → collect (species_key, bd_ft_pp) per product
      2. Upsert species_assignments (one per quote × species_key)
      3. Upsert built-in species cost blocks (one per product × species_key)
      4. Remove stale species blocks for species no longer in the product
    """
    from decimal import Decimal

    # ── Pass 1: collect species bdft from tops and components ──────────
    # species_key → total bdft across entire quote (qty-weighted)
    species_total_bdft: dict[str, Decimal] = {}
    # species_key → (species_name, quarter_code)
    species_meta: dict[str, tuple[str, str]] = {}
    # product.id str → {species_key: bd_ft_pp}
    product_species_bdft: dict[str, dict[str, Decimal]] = {}

    LUMBER_COMPONENTS = ("plank", "leg", "apron_l", "apron_w")

    for option in quote.options:
        for product in option.products:
            pid = str(product.id)
            qty = Decimal(str(product.quantity or 1))
            product_species_bdft[pid] = {}

            # Top bdft (Hardwood / Live Edge only)
            if product.material_type in ("Hardwood", "Live Edge"):
                if product.material_detail and product.lumber_thickness:
                    thickness_str = product.lumber_thickness
                    raw_thickness = THICKNESS_LOOKUP.get(thickness_str)
                    quarter_code = QUARTER_CODE_LOOKUP.get(thickness_str, "")

                    if raw_thickness and quarter_code:
                        species_name = product.material_detail.strip()
                        species_key = f"{species_name} {quarter_code}"

                        w = Decimal(str(product.width or 0))
                        l = Decimal(str(product.length or 0))
                        bd_ft_pp = Decimal("0")
                        if w > 0 and l > 0:
                            bd_ft_pp = (w * l * raw_thickness / Decimal("144")) * WASTE_FACTOR_TOP

                        product_species_bdft[pid][species_key] = (
                            product_species_bdft[pid].get(species_key, Decimal("0")) + bd_ft_pp
                        )
                        species_total_bdft[species_key] = (
                            species_total_bdft.get(species_key, Decimal("0")) + bd_ft_pp * qty
                        )
                        species_meta[species_key] = (species_name, quarter_code)

            # Component bdft (plank, leg, apron variants)
            for comp in product.components:
                if comp.component_type not in LUMBER_COMPONENTS:
                    continue
                if not comp.material or not comp.thickness:
                    continue

                # Derive quarter code from raw thickness
                raw_t = round(float(comp.thickness), 1)
                quarter_code = COMPONENT_QUARTER_CODE_LOOKUP.get(str(raw_t))
                if not quarter_code:
                    continue

                species_name = comp.material.strip()
                species_key = f"{species_name} {quarter_code}"

                thickness_dec = Decimal(str(comp.thickness))
                w = Decimal(str(comp.width or 0))
                l = Decimal(str(comp.length or 0))
                qty_per_base = int(comp.qty_per_base or 1)
                bases_per_top = int(product.bases_per_top or 1)

                bd_ft_per_piece = Decimal("0")
                if w > 0 and l > 0:
                    bd_ft_per_piece = (
                        (w * l * thickness_dec / Decimal("144")) * WASTE_FACTOR_BASE
                    )

                comp_bd_ft_pp = bd_ft_per_piece * qty_per_base * bases_per_top

                product_species_bdft[pid][species_key] = (
                    product_species_bdft[pid].get(species_key, Decimal("0")) + comp_bd_ft_pp
                )
                species_total_bdft[species_key] = (
                    species_total_bdft.get(species_key, Decimal("0")) + comp_bd_ft_pp * qty
                )
                species_meta[species_key] = (species_name, quarter_code)

    if not species_total_bdft:
        return

    # ── Pass 2: upsert species_assignments ─────────────────────────────
    existing_sa: dict[str, SpeciesAssignment] = {
        sa.species_key: sa for sa in quote.species_assignments
    }
    prices: dict[str, Decimal] = {}

    for species_key, total_bdft in species_total_bdft.items():
        species_name, quarter_code = species_meta[species_key]

        if species_key in existing_sa:
            sa = existing_sa[species_key]
            sa.total_bdft = float(total_bdft)
        else:
            sa = SpeciesAssignment(
                quote_id=quote.id,
                species_name=species_name,
                quarter_code=quarter_code,
                species_key=species_key,
                price_per_bdft=None,
                total_bdft=float(total_bdft),
                total_cost=None,
            )
            db.add(sa)
            existing_sa[species_key] = sa

        price = Decimal(str(sa.price_per_bdft or 0))
        sa.total_cost = float(total_bdft * price) if price else None
        prices[species_key] = price

    await db.flush()

    # ── Pass 3: upsert built-in species cost blocks ────────────────────
    # One block per (product, species_key). Keyed by description = species_key.
    # Uses per_unit with units_per_product = total bd_ft_pp for that species,
    # so cost_pp = price_per_bdft × total_bd_ft_pp.
    for option in quote.options:
        for product in option.products:
            pid = str(product.id)
            species_by_key = product_species_bdft.get(pid, {})

            if not species_by_key:
                # Remove any stale species blocks if product no longer has lumber
                stale = [cb for cb in product.cost_blocks
                         if cb.is_builtin and cb.cost_category == "species"]
                for cb in stale:
                    await db.delete(cb)
                continue

            # Index existing built-in species blocks by description (= species_key)
            existing_blocks: dict[str, CostBlock] = {
                cb.description: cb
                for cb in product.cost_blocks
                if cb.is_builtin and cb.cost_category == "species"
            }

            # Upsert one block per species_key
            for species_key, bd_ft_pp in species_by_key.items():
                price = prices.get(species_key, Decimal("0"))

                if species_key in existing_blocks:
                    cb = existing_blocks.pop(species_key)
                    cb.cost_per_unit = float(price) if price else None
                    cb.units_per_product = float(bd_ft_pp)
                else:
                    cb = CostBlock(
                        product_id=product.id,
                        sort_order=0,
                        cost_category="species",
                        description=species_key,
                        cost_per_unit=float(price) if price else None,
                        units_per_product=float(bd_ft_pp),
                        multiplier_type="per_unit",
                        is_builtin=True,
                    )
                    db.add(cb)
                    product.cost_blocks.append(cb)

            # Remove stale species blocks (species no longer on this product)
            for stale_cb in existing_blocks.values():
                await db.delete(stale_cb)
                product.cost_blocks.remove(stale_cb)

    await db.flush()


# Default configs for built-in rate labor blocks, keyed by material_type.
# rate_value units: sqft/hr for panel_sqft/top_sqft sources, panels/hr for panel_count.
# Default rates verified against Farmhouse Kitchen 0737.
_BUILTIN_RATE_LABOR: dict[str, list[dict]] = {
    "Hardwood": [
        {"labor_center": "LC101", "description": "Processing",     "metric_source": "panel_sqft",  "rate_value": 15.0},
        {"labor_center": "LC102", "description": "Belt Sanding",   "metric_source": "panel_sqft",  "rate_value": 40.0},
        {"labor_center": "LC103", "description": "Cutting",        "metric_source": "panel_count", "rate_value": 8.0},
        {"labor_center": "LC106", "description": "Finish Sanding", "metric_source": "panel_sqft",  "rate_value": 12.0},
        {"labor_center": "LC109", "description": "Finishing",      "metric_source": "panel_sqft",  "rate_value": 40.0},
    ],
    "Stone": [
        {"labor_center": "LC108", "description": "Stone Fab",      "metric_source": "top_sqft",    "rate_value": 10.0},
    ],
}
_BUILTIN_RATE_LABOR["Live Edge"] = _BUILTIN_RATE_LABOR["Hardwood"]
_BUILTIN_RATE_LABOR["Laminate"] = _BUILTIN_RATE_LABOR["Hardwood"]


async def manage_rate_labor_pipeline(db: AsyncSession, quote: Quote) -> None:
    """
    Ensure built-in rate labor blocks exist for each product based on material_type.

    Creates the block with the default rate if it doesn't exist. Does NOT overwrite
    rate_value on existing blocks (user may have customized the rate).
    Removes built-in rate blocks whose labor_center is no longer appropriate
    for the current material_type.

    Called before the engine runs so the blocks are included in computation.
    """
    for option in quote.options:
        for product in option.products:
            expected = _BUILTIN_RATE_LABOR.get(product.material_type, [])
            expected_lcs = {cfg["labor_center"] for cfg in expected}

            # Index existing built-in rate labor blocks by labor_center
            existing: dict[str, LaborBlock] = {
                lb.labor_center: lb
                for lb in product.labor_blocks
                if lb.is_builtin and lb.block_type == "rate"
            }

            # Remove stale blocks (labor center no longer expected for this material)
            for lc, lb in list(existing.items()):
                if lc not in expected_lcs:
                    await db.delete(lb)
                    product.labor_blocks.remove(lb)

            # Create missing blocks with default rates
            for cfg in expected:
                lc = cfg["labor_center"]
                if lc not in existing:
                    lb = LaborBlock(
                        product_id=product.id,
                        sort_order=0,
                        labor_center=lc,
                        description=cfg["description"],
                        block_type="rate",
                        metric_source=cfg["metric_source"],
                        rate_value=cfg["rate_value"],
                        is_active=True,
                        is_builtin=True,
                    )
                    db.add(lb)
                    product.labor_blocks.append(lb)

    await db.flush()


async def manage_stone_pipeline(db: AsyncSession, quote: Quote) -> None:
    """
    Ensure stone_assignment records and built-in stone cost blocks are
    up-to-date for all Stone products in the quote.

    Called before compute_quote() in recalculate_quote().

    Stone products are grouped by stone_key (= material_detail, e.g. "Quartz").
    The user enters total_cost on the stone_assignment record.
    The pipeline derives cost_per_sqft = total_cost / total_sqft and creates
    a built-in cost block on each product:
      cost_category = "stone", multiplier_type = "per_sqft",
      cost_per_unit = cost_per_sqft → cost_pp = cost_per_sqft × product.sq_ft

    Flow:
      1. Scan Stone products → accumulate total_sqft per stone_key
      2. Upsert stone_assignment records
      3. Upsert built-in stone cost blocks on each product
    """
    from decimal import Decimal

    # ── Pass 1: collect sqft from Stone products ───────────────────────
    # stone_key → total_sqft across quote (qty-weighted)
    stone_total_sqft: dict[str, Decimal] = {}
    # product.id str → (stone_key, sq_ft per product)
    product_stone: dict[str, tuple[str, Decimal]] = {}

    for option in quote.options:
        for product in option.products:
            if not product.material_type or not product.material_type.startswith("Stone"):
                continue
            if not product.width or not product.length:
                continue

            stone_key = (product.material_detail or "Stone").strip()
            w = Decimal(str(product.width))
            l = Decimal(str(product.length))
            # Stone uses actual DIA-adjusted sqft (product.sq_ft) — exact area, not W×L
            # For now compute from dimensions; sq_ft will be set by engine later
            import math
            if product.shape == "DIA":
                radius_ft = w / Decimal("24")
                sq_ft = (Decimal(str(math.pi)) * radius_ft * radius_ft).quantize(Decimal("0.0001"))
            else:
                sq_ft = (w / Decimal("12")) * (l / Decimal("12"))

            qty = Decimal(str(product.quantity or 1))
            pid = str(product.id)
            product_stone[pid] = (stone_key, sq_ft)
            stone_total_sqft[stone_key] = (
                stone_total_sqft.get(stone_key, Decimal("0")) + sq_ft * qty
            )

    if not stone_total_sqft:
        return

    # ── Pass 2: upsert stone_assignments ──────────────────────────────
    existing_sa: dict[str, StoneAssignment] = {
        sa.stone_key: sa for sa in quote.stone_assignments
    }
    cost_per_sqft: dict[str, Decimal] = {}

    for stone_key, total_sqft in stone_total_sqft.items():
        if stone_key in existing_sa:
            sa = existing_sa[stone_key]
            sa.total_sqft = float(total_sqft)
        else:
            sa = StoneAssignment(
                quote_id=quote.id,
                stone_key=stone_key,
                total_sqft=float(total_sqft),
                total_cost=None,
            )
            db.add(sa)
            existing_sa[stone_key] = sa

        total_cost = Decimal(str(sa.total_cost or 0))
        if total_sqft > 0 and total_cost > 0:
            rate = total_cost / total_sqft
        else:
            rate = Decimal("0")
        cost_per_sqft[stone_key] = rate

    await db.flush()

    # ── Pass 3: upsert built-in stone cost blocks ──────────────────────
    for option in quote.options:
        for product in option.products:
            pid = str(product.id)
            if pid not in product_stone:
                # Remove stale stone blocks if material changed away from Stone
                stale = [cb for cb in product.cost_blocks
                         if cb.is_builtin and cb.cost_category == "stone"]
                for cb in stale:
                    await db.delete(cb)
                continue

            stone_key, _ = product_stone[pid]
            rate = cost_per_sqft.get(stone_key, Decimal("0"))

            existing_block = next(
                (cb for cb in product.cost_blocks
                 if cb.is_builtin and cb.cost_category == "stone"),
                None,
            )

            if existing_block:
                existing_block.cost_per_unit = float(rate) if rate else None
                existing_block.description = stone_key
            else:
                cb = CostBlock(
                    product_id=product.id,
                    sort_order=0,
                    cost_category="stone",
                    description=stone_key,
                    cost_per_unit=float(rate) if rate else None,
                    units_per_product=1,
                    multiplier_type="per_sqft",
                    is_builtin=True,
                )
                db.add(cb)
                product.cost_blocks.append(cb)

    await db.flush()


async def recalculate_quote(db: AsyncSession, quote_id: uuid.UUID) -> Quote | None:
    """
    The main entry point called after any input change.
    Loads the full quote, runs the engine, saves results, commits.
    """
    quote = await load_full_quote(db, quote_id)
    if not quote:
        return None

    # Species pipeline: upsert species_assignments + built-in species cost blocks
    # before the engine runs, so the blocks are included in the engine input.
    await manage_species_pipeline(db, quote)

    # Stone pipeline: upsert stone_assignments + built-in stone cost blocks.
    await manage_stone_pipeline(db, quote)

    # Rate labor pipeline: ensure built-in rate labor blocks exist for each product.
    await manage_rate_labor_pipeline(db, quote)

    tags = await load_tags(db)
    engine_input = quote_to_engine_format(quote, tags)
    engine_result = compute_quote(engine_input)
    await save_computed_results(db, quote, engine_result)
    await db.commit()

    # Reload to get fresh computed values
    return await load_full_quote(db, quote_id)
