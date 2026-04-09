"""
Quote Service — business logic layer (Phase 2 quote block architecture).

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
    Quote, QuoteOption, Product, QuoteBlock, QuoteBlockMember,
    Tag, SpeciesAssignment, ProductComponent, StoneAssignment,
    SystemDefaults,
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
                .selectinload(Product.components),
            selectinload(Quote.options)
                .selectinload(QuoteOption.products)
                .selectinload(Product.description_items),
            selectinload(Quote.quote_blocks)
                .selectinload(QuoteBlock.members),
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


async def load_system_defaults(db: AsyncSession) -> SystemDefaults | None:
    """Load the global system defaults row."""
    result = await db.execute(select(SystemDefaults).where(SystemDefaults.key == "global"))
    return result.scalar_one_or_none()


def quote_to_engine_format(quote: Quote, tags: dict[str, str]) -> dict:
    """
    Convert ORM objects to the dict format compute_quote() expects.
    V2: quote_blocks with members instead of per-product blocks + group pools.
    """
    options_data = []
    for option in quote.options:
        products_data = []
        for product in option.products:
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
                        "depth": c.depth,
                        "thickness": c.thickness,
                        "qty_per_base": c.qty_per_base,
                        "material": c.material,
                    }
                    for c in product.components
                ],
            })

        options_data.append({
            "id": str(option.id),
            "name": option.name,
            "products": products_data,
        })

    # Quote blocks with members
    quote_blocks_data = []
    for block in quote.quote_blocks:
        members_data = []
        for m in block.members:
            members_data.append({
                "id": str(m.id),
                "product_id": str(m.product_id),
                "description": m.description,
                "hours_per_unit": m.hours_per_unit,
                "cost_per_unit": m.cost_per_unit,
                "units_per_product": m.units_per_product,
                "is_active": m.is_active,
            })

        quote_blocks_data.append({
            "id": str(block.id),
            "tag_id": str(block.tag_id) if block.tag_id else None,
            "block_domain": block.block_domain,
            "block_type": block.block_type,
            "label": block.label,
            "is_builtin": block.is_builtin,
            "is_active": block.is_active,
            # Cost fields
            "cost_category": block.cost_category,
            "cost_per_unit": block.cost_per_unit,
            "units_per_product": block.units_per_product,
            "multiplier_type": block.multiplier_type,
            # Labor fields
            "labor_center": block.labor_center,
            "rate_value": block.rate_value,
            "metric_source": block.metric_source,
            "rate_type": block.rate_type or "metric",
            "hours_per_unit": block.hours_per_unit,
            # Group fields
            "total_amount": block.total_amount,
            "total_hours": block.total_hours,
            "distribution_type": block.distribution_type,
            "on_qty_change": block.on_qty_change,
            # Members
            "members": members_data,
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
        "quote_blocks": quote_blocks_data,
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
    component_map: dict[str, ProductComponent] = {}

    for option in quote.options:
        for product in option.products:
            product_map[str(product.id)] = product
            for c in product.components:
                component_map[str(c.id)] = c

    # Options + Products
    for opt_data in engine_result.get("options", []):
        for orm_opt in quote.options:
            if str(orm_opt.id) == opt_data["id"]:
                orm_opt.total_cost = _dec(opt_data.get("total_cost"))
                orm_opt.total_price = _dec(opt_data.get("total_price"))
                orm_opt.total_hours = _dec(opt_data.get("total_hours"))
                break

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

            # Components
            for c_data in prod_data.get("components", []):
                orm_c = component_map.get(c_data.get("id"))
                if orm_c:
                    orm_c.bd_ft_per_piece = _dec(c_data.get("bd_ft_per_piece"))
                    orm_c.bd_ft_pp = _dec(c_data.get("bd_ft_pp"))
                    orm_c.sq_ft_per_piece = _dec(c_data.get("sq_ft_per_piece"))
                    orm_c.sq_ft_pp = _dec(c_data.get("sq_ft_pp"))

    # Quote block members — write computed values back
    member_map: dict[str, QuoteBlockMember] = {}
    for block in quote.quote_blocks:
        for m in block.members:
            member_map[str(m.id)] = m

    for block_data in engine_result.get("quote_blocks", []):
        for m_data in block_data.get("members", []):
            orm_m = member_map.get(m_data.get("id"))
            if orm_m:
                orm_m.cost_pp = _dec(m_data.get("cost_pp"))
                orm_m.cost_pt = _dec(m_data.get("cost_pt"))
                orm_m.hours_pp = _dec(m_data.get("hours_pp"))
                orm_m.hours_pt = _dec(m_data.get("hours_pt"))
                orm_m.metric_value = _dec(m_data.get("metric_value"))

    await db.flush()


async def manage_species_pipeline(db: AsyncSession, quote: Quote) -> None:
    """
    Ensure species_assignment records and built-in species cost blocks are
    up-to-date for all Hardwood/Live Edge products in the quote.

    Creates quote-level QuoteBlock (block_domain='cost', block_type='unit',
    cost_category='species') with QuoteBlockMember per product.

    Supports multiple species per product (top + components with different species).
    Each species_key gets its own built-in block with per-member cost_per_unit = price_per_bdft
    and units_per_product = bd_ft_pp for that species on that product.

    Pass 1 collects RAW bdft (no waste). Pass 2 upserts species assignments.
    Pass 2.5 applies the assignment's waste_factor to get final bdft values.
    Pass 3 upserts blocks with waste-adjusted bdft.
    """
    from decimal import Decimal

    # ── Pass 1: collect RAW species bdft from tops and components ──────
    # Raw = no waste factor applied. Waste is applied after we have the assignment.
    species_raw_bdft: dict[str, Decimal] = {}
    species_meta: dict[str, tuple[str, str]] = {}
    product_species_raw_bdft: dict[str, dict[str, Decimal]] = {}

    LUMBER_COMPONENTS = ("plank", "leg", "apron_l", "apron_w")

    for option in quote.options:
        for product in option.products:
            pid = str(product.id)
            qty = Decimal(str(product.quantity or 1))
            product_species_raw_bdft[pid] = {}

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
                        raw_bd_ft_pp = Decimal("0")
                        if w > 0 and l > 0:
                            raw_bd_ft_pp = w * l * raw_thickness / Decimal("144")

                        product_species_raw_bdft[pid][species_key] = (
                            product_species_raw_bdft[pid].get(species_key, Decimal("0")) + raw_bd_ft_pp
                        )
                        species_raw_bdft[species_key] = (
                            species_raw_bdft.get(species_key, Decimal("0")) + raw_bd_ft_pp * qty
                        )
                        species_meta[species_key] = (species_name, quarter_code)

            # Component bdft (plank, leg, apron variants)
            for comp in product.components:
                if comp.component_type not in LUMBER_COMPONENTS:
                    continue
                if not comp.material or not comp.thickness:
                    continue

                raw_t = round(float(comp.thickness), 1)
                quarter_code = COMPONENT_QUARTER_CODE_LOOKUP.get(str(raw_t))
                if not quarter_code:
                    continue

                species_name = comp.material.strip()
                species_key = f"{species_name} {quarter_code}"

                # Use depth for volume if set, otherwise fall back to lumber thickness
                depth_val = Decimal(str(comp.depth)) if comp.depth else None
                thickness_dec = Decimal(str(comp.thickness))
                dim3 = depth_val if depth_val and depth_val > 0 else thickness_dec

                w = Decimal(str(comp.width or 0))
                l = Decimal(str(comp.length or 0))
                qty_per_base = int(comp.qty_per_base or 1)
                bases_per_top = int(product.bases_per_top or 1)

                raw_bd_ft_per_piece = Decimal("0")
                if w > 0 and l > 0 and dim3 > 0:
                    raw_bd_ft_per_piece = w * l * dim3 / Decimal("144")

                raw_comp_bd_ft_pp = raw_bd_ft_per_piece * qty_per_base * bases_per_top

                product_species_raw_bdft[pid][species_key] = (
                    product_species_raw_bdft[pid].get(species_key, Decimal("0")) + raw_comp_bd_ft_pp
                )
                species_raw_bdft[species_key] = (
                    species_raw_bdft.get(species_key, Decimal("0")) + raw_comp_bd_ft_pp * qty
                )
                species_meta[species_key] = (species_name, quarter_code)

    if not species_raw_bdft:
        return

    # ── Pass 2: upsert species_assignments ─────────────────────────────
    existing_sa: dict[str, SpeciesAssignment] = {
        sa.species_key: sa for sa in quote.species_assignments
    }
    prices: dict[str, Decimal] = {}
    waste_factors: dict[str, Decimal] = {}

    for species_key, raw_total in species_raw_bdft.items():
        species_name, quarter_code = species_meta[species_key]

        if species_key in existing_sa:
            sa = existing_sa[species_key]
        else:
            sa = SpeciesAssignment(
                quote_id=quote.id,
                species_name=species_name,
                quarter_code=quarter_code,
                species_key=species_key,
                price_per_bdft=None,
                waste_factor=0.25,
                total_bdft=None,
                total_cost=None,
            )
            db.add(sa)
            existing_sa[species_key] = sa

        waste = Decimal(str(sa.waste_factor if sa.waste_factor is not None else 0.25))
        waste_factors[species_key] = waste

        # Apply waste factor: total_bdft = raw × (1 + waste)
        waste_mult = Decimal("1") + waste
        total_bdft = raw_total * waste_mult
        sa.total_bdft = float(total_bdft)

        price = Decimal(str(sa.price_per_bdft or 0))
        sa.total_cost = float(total_bdft * price) if price else None
        prices[species_key] = price

    await db.flush()

    # ── Pass 2.5: apply waste to per-product bdft ─────────────────────
    product_species_bdft: dict[str, dict[str, Decimal]] = {}
    for pid, raw_map in product_species_raw_bdft.items():
        product_species_bdft[pid] = {}
        for species_key, raw_bdft in raw_map.items():
            waste = waste_factors.get(species_key, Decimal("0.25"))
            product_species_bdft[pid][species_key] = raw_bdft * (Decimal("1") + waste)

    # ── Pass 3: upsert built-in species QuoteBlocks ───────────────────
    # One block per species_key. Members are products that use that species.
    # Block: cost_category='species', multiplier_type='per_unit',
    #        cost_per_unit = price_per_bdft (on block),
    #        units_per_product = bd_ft_pp for that species (varies per member, but
    #        stored at block level since the engine uses it from the block).
    # Actually, units_per_product varies per product × species, so we store
    # bd_ft_pp per member by using cost_per_unit on the member.
    # Strategy: block.cost_per_unit = 1 (identity), member.cost_per_unit = price × bdft
    # Simpler: block stores price, multiplier_type = per_unit,
    # each member's units_per_product effectively comes from the member override.
    #
    # Cleanest approach: block has multiplier_type='per_unit', cost_per_unit=price_per_bdft.
    # We set units_per_product on the block to 1 (not used for per_unit when member
    # doesn't override cost_per_unit). Each member's cost_per_unit = price × bd_ft_pp
    # so cost_pp = cost_per_unit × units_per_product = (price×bdft) × 1 = price×bdft.
    #
    # Wait — the engine compute_cost_block uses block.units_per_product for per_unit type.
    # So cost_pp = member.cost_per_unit × block.units_per_product.
    # We want cost_pp = price_per_bdft × bd_ft_pp.
    # Set member.cost_per_unit = price_per_bdft, block.units_per_product = bd_ft_pp?
    # No, bdft varies per member.
    #
    # Best approach: each member stores cost_per_unit = price × bdft (the total species
    # cost for this product). Block uses multiplier_type='per_unit', units_per_product=1.
    # Engine: cost_pp = cost_per_unit × 1 = pre-computed species cost.

    existing_blocks: dict[str, QuoteBlock] = {
        b.label: b
        for b in quote.quote_blocks
        if b.is_builtin and b.block_domain == "cost" and b.cost_category == "species"
    }

    for species_key in species_raw_bdft:
        price = prices.get(species_key, Decimal("0"))

        is_new_block = False
        if species_key in existing_blocks:
            block = existing_blocks.pop(species_key)
        else:
            is_new_block = True
            block = QuoteBlock(
                quote_id=quote.id,
                sort_order=0,
                is_builtin=True,
                is_active=True,
                block_domain="cost",
                block_type="unit",
                label=species_key,
                cost_category="species",
                cost_per_unit=None,  # member-level override used instead
                units_per_product=1,
                multiplier_type="per_unit",
            )
            db.add(block)
            quote.quote_blocks.append(block)

        await db.flush()

        # Build member map for this block (new blocks have no members yet)
        existing_members: dict[str, QuoteBlockMember] = (
            {} if is_new_block
            else {str(m.product_id): m for m in block.members}
        )

        # Determine which products need members
        for option in quote.options:
            for product in option.products:
                pid = str(product.id)
                bd_ft = product_species_bdft.get(pid, {}).get(species_key)
                if bd_ft is None or bd_ft == 0:
                    # Remove stale member if exists
                    if pid in existing_members:
                        await db.delete(existing_members.pop(pid))
                    continue

                member_cost = float(price * bd_ft) if price else None

                if pid in existing_members:
                    m = existing_members.pop(pid)
                    m.cost_per_unit = member_cost
                    m.units_per_product = float(bd_ft)
                else:
                    m = QuoteBlockMember(
                        quote_block_id=block.id,
                        product_id=product.id,
                        cost_per_unit=member_cost,
                        units_per_product=float(bd_ft),
                    )
                    db.add(m)
                    # Don't append to block.members — triggers lazy load in async.
                    # db.add(m) with FK is sufficient; load_full_quote reloads eagerly.

        # Remove any remaining stale members
        for stale_m in existing_members.values():
            await db.delete(stale_m)

    # Remove stale species blocks (species no longer in any product)
    for stale_block in existing_blocks.values():
        await db.delete(stale_block)
        if stale_block in quote.quote_blocks:
            quote.quote_blocks.remove(stale_block)

    await db.flush()


# Default configs for built-in rate labor blocks, keyed by material_type.
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
    Ensure built-in rate labor blocks exist for each material_type's labor centers.

    Creates quote-level QuoteBlocks (block_domain='labor', block_type='rate')
    with members for products of the relevant material type.

    Does NOT overwrite rate_value on existing blocks (user may have customized).
    Removes blocks whose labor_center is no longer needed by any product.
    """
    # Collect which labor centers are needed and which products need them
    # lc_key = (labor_center, metric_source) to handle uniqueness
    needed_lcs: dict[str, dict] = {}  # labor_center → config dict
    lc_products: dict[str, list[Product]] = {}  # labor_center → [products]

    for option in quote.options:
        for product in option.products:
            configs = _BUILTIN_RATE_LABOR.get(product.material_type, [])
            for cfg in configs:
                lc = cfg["labor_center"]
                if lc not in needed_lcs:
                    needed_lcs[lc] = cfg
                    lc_products[lc] = []
                lc_products[lc].append(product)

    # Index existing built-in rate labor blocks by labor_center
    existing_blocks: dict[str, QuoteBlock] = {
        b.labor_center: b
        for b in quote.quote_blocks
        if b.is_builtin and b.block_domain == "labor" and b.block_type == "rate"
        and b.labor_center is not None
    }

    # Remove stale blocks (labor center no longer needed by any product)
    for lc, block in list(existing_blocks.items()):
        if lc not in needed_lcs:
            await db.delete(block)
            if block in quote.quote_blocks:
                quote.quote_blocks.remove(block)
            del existing_blocks[lc]

    # Upsert blocks and members
    for lc, cfg in needed_lcs.items():
        products = lc_products[lc]

        is_new_block = False
        if lc in existing_blocks:
            block = existing_blocks[lc]
            # Don't overwrite rate_value — user may have customized
        else:
            is_new_block = True
            block = QuoteBlock(
                quote_id=quote.id,
                sort_order=0,
                is_builtin=True,
                is_active=True,
                block_domain="labor",
                block_type="rate",
                label=cfg["description"],
                labor_center=lc,
                rate_value=cfg["rate_value"],
                metric_source=cfg["metric_source"],
                rate_type="metric",
            )
            db.add(block)
            quote.quote_blocks.append(block)

        await db.flush()

        # Sync members: add missing, remove stale (new blocks have no members yet)
        existing_members: dict[str, QuoteBlockMember] = (
            {} if is_new_block
            else {str(m.product_id): m for m in block.members}
        )
        needed_pids = {str(p.id) for p in products}

        # Remove stale members
        for pid, m in list(existing_members.items()):
            if pid not in needed_pids:
                await db.delete(m)

        # Add missing members
        for product in products:
            pid = str(product.id)
            if pid not in existing_members:
                m = QuoteBlockMember(
                    quote_block_id=block.id,
                    product_id=product.id,
                )
                db.add(m)

    await db.flush()


async def manage_stone_pipeline(db: AsyncSession, quote: Quote) -> None:
    """
    Ensure stone_assignment records and built-in stone cost blocks are
    up-to-date for all Stone products in the quote.

    Creates quote-level QuoteBlock (block_domain='cost', block_type='unit',
    cost_category='stone') with members per stone product.
    """
    from decimal import Decimal
    import math

    # ── Pass 1: collect sqft from Stone products ───────────────────────
    # Group by stone_group number (user-assigned). Default to 1 if not set.
    stone_total_sqft: dict[str, Decimal] = {}
    product_stone: dict[str, tuple[str, Decimal]] = {}

    for option in quote.options:
        for product in option.products:
            if not product.material_type or not product.material_type.startswith("Stone"):
                continue
            if not product.width or not product.length:
                continue

            group_num = product.stone_group or 1
            stone_key = str(group_num)
            w = Decimal(str(product.width))
            l = Decimal(str(product.length))
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

    # ── Pass 3: upsert built-in stone QuoteBlocks ─────────────────────
    # One block per stone_key, with members for stone products of that key.
    # multiplier_type='per_sqft', cost_per_unit = cost_per_sqft
    existing_blocks: dict[str, QuoteBlock] = {
        b.label: b
        for b in quote.quote_blocks
        if b.is_builtin and b.block_domain == "cost" and b.cost_category == "stone"
    }

    for stone_key, total_sqft in stone_total_sqft.items():
        rate = cost_per_sqft.get(stone_key, Decimal("0"))

        is_new_block = False
        if stone_key in existing_blocks:
            block = existing_blocks.pop(stone_key)
            block.cost_per_unit = float(rate) if rate else None
        else:
            is_new_block = True
            block = QuoteBlock(
                quote_id=quote.id,
                sort_order=0,
                is_builtin=True,
                is_active=True,
                block_domain="cost",
                block_type="unit",
                label=stone_key,
                cost_category="stone",
                cost_per_unit=float(rate) if rate else None,
                units_per_product=1,
                multiplier_type="per_sqft",
            )
            db.add(block)
            quote.quote_blocks.append(block)

        await db.flush()

        # Sync members (new blocks have no members yet)
        existing_members: dict[str, QuoteBlockMember] = (
            {} if is_new_block
            else {str(m.product_id): m for m in block.members}
        )

        needed_pids = set()
        for option in quote.options:
            for product in option.products:
                pid = str(product.id)
                if pid in product_stone:
                    sk, sq_ft = product_stone[pid]
                    if sk == stone_key:
                        needed_pids.add(pid)
                        if pid in existing_members:
                            m = existing_members[pid]
                            m.units_per_product = float(sq_ft)
                        else:
                            m = QuoteBlockMember(
                                quote_block_id=block.id,
                                product_id=product.id,
                                units_per_product=float(sq_ft),
                            )
                            db.add(m)
                            # Don't append to block.members — triggers lazy load in async.

        # Remove stale members
        for pid, m in existing_members.items():
            if pid not in needed_pids:
                await db.delete(m)

    # Remove stale stone blocks
    for stale_block in existing_blocks.values():
        await db.delete(stale_block)
        if stale_block in quote.quote_blocks:
            quote.quote_blocks.remove(stale_block)

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
    await manage_species_pipeline(db, quote)

    # Stone pipeline: upsert stone_assignments + built-in stone cost blocks
    await manage_stone_pipeline(db, quote)

    # Rate labor pipeline: ensure built-in rate labor blocks exist
    await manage_rate_labor_pipeline(db, quote)

    # Reload after pipelines — they may have created new blocks/members
    # that aren't eagerly loaded on the original quote object
    await db.flush()
    quote = await load_full_quote(db, quote_id)

    tags = await load_tags(db)
    engine_input = quote_to_engine_format(quote, tags)
    engine_result = compute_quote(engine_input)
    await save_computed_results(db, quote, engine_result)
    await db.commit()

    # Reload to get fresh computed values
    return await load_full_quote(db, quote_id)
