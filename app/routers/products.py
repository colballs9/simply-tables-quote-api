"""
Products router — add, update, delete products within a quote option.
Every mutation triggers quote recalculation.

On product create: inherits hourly_rate + margin rates from quote defaults,
and adds the new product as a member to all non-builtin quote blocks.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Product, QuoteOption, Quote, QuoteBlock, QuoteBlockMember
from ..schemas import ProductCreate, ProductUpdate, ProductRead, QuoteRead
from ..services.quote_service import recalculate_quote, load_full_quote

router = APIRouter(prefix="/options/{option_id}/products", tags=["products"])


async def _get_option_and_quote(db: AsyncSession, option_id: uuid.UUID) -> tuple[QuoteOption, Quote]:
    """Resolve option → quote for recalculation and default inheritance."""
    stmt = (
        select(QuoteOption)
        .where(QuoteOption.id == option_id)
        .options(selectinload(QuoteOption.quote))
    )
    result = await db.execute(stmt)
    option = result.scalar_one_or_none()
    if not option:
        raise HTTPException(404, "Option not found")
    return option, option.quote


@router.post("", response_model=QuoteRead, status_code=201)
async def add_product(option_id: uuid.UUID, data: ProductCreate, db: AsyncSession = Depends(get_db)):
    option, quote = await _get_option_and_quote(db, option_id)

    product_data = data.model_dump()

    # Inherit hourly_rate from quote defaults if not provided
    if product_data.get("hourly_rate") is None:
        product_data["hourly_rate"] = float(quote.default_hourly_rate)

    # Inherit margin rates from quote defaults
    margin_fields = [
        "hardwood_margin_rate", "stone_margin_rate", "stock_base_margin_rate",
        "stock_base_ship_margin_rate", "powder_coat_margin_rate", "custom_base_margin_rate",
        "unit_cost_margin_rate", "group_cost_margin_rate", "misc_margin_rate",
        "consumables_margin_rate",
    ]
    for field in margin_fields:
        if field not in product_data or product_data[field] is None:
            product_data[field] = float(getattr(quote, f"default_{field}"))

    product = Product(option_id=option_id, **product_data)
    db.add(product)
    await db.flush()

    # Add product as member to all non-builtin quote blocks
    stmt = select(QuoteBlock).where(
        QuoteBlock.quote_id == quote.id,
        QuoteBlock.is_builtin == False,
    )
    result = await db.execute(stmt)
    blocks = result.scalars().all()
    for block in blocks:
        member = QuoteBlockMember(quote_block_id=block.id, product_id=product.id)
        db.add(member)

    await db.flush()
    recalc_result = await recalculate_quote(db, quote.id)
    return QuoteRead.model_validate(recalc_result)


@router.patch("/{product_id}", response_model=QuoteRead)
async def update_product(
    option_id: uuid.UUID,
    product_id: uuid.UUID,
    data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
):
    option, quote = await _get_option_and_quote(db, option_id)

    product = await db.get(Product, product_id)
    if not product or product.option_id != option_id:
        raise HTTPException(404, "Product not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    await db.flush()
    result = await recalculate_quote(db, quote.id)
    return QuoteRead.model_validate(result)


@router.delete("/{product_id}", response_model=QuoteRead)
async def delete_product(
    option_id: uuid.UUID,
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    option, quote = await _get_option_and_quote(db, option_id)

    product = await db.get(Product, product_id)
    if not product or product.option_id != option_id:
        raise HTTPException(404, "Product not found")

    await db.delete(product)
    await db.flush()

    result = await recalculate_quote(db, quote.id)
    return QuoteRead.model_validate(result)
