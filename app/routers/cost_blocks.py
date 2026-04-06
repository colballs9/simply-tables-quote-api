"""
Cost blocks router — add, update, delete unit cost blocks on a product.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from ..database import get_db
from ..models import Product, CostBlock, QuoteOption
from ..schemas import CostBlockCreate, CostBlockUpdate, QuoteRead
from ..services.quote_service import recalculate_quote

router = APIRouter(prefix="/products/{product_id}/cost-blocks", tags=["cost_blocks"])


async def _get_quote_id(db: AsyncSession, product_id: uuid.UUID) -> uuid.UUID:
    """Resolve product → option → quote."""
    stmt = (
        select(QuoteOption.quote_id)
        .join(Product, Product.option_id == QuoteOption.id)
        .where(Product.id == product_id)
    )
    result = await db.execute(stmt)
    quote_id = result.scalar_one_or_none()
    if not quote_id:
        raise HTTPException(404, "Product not found")
    return quote_id


@router.post("", response_model=QuoteRead, status_code=201)
async def add_cost_block(product_id: uuid.UUID, data: CostBlockCreate, db: AsyncSession = Depends(get_db)):
    quote_id = await _get_quote_id(db, product_id)

    block = CostBlock(product_id=product_id, **data.model_dump())
    db.add(block)
    await db.flush()

    quote = await recalculate_quote(db, quote_id)
    return QuoteRead.model_validate(quote)


@router.patch("/{block_id}", response_model=QuoteRead)
async def update_cost_block(
    product_id: uuid.UUID,
    block_id: uuid.UUID,
    data: CostBlockUpdate,
    db: AsyncSession = Depends(get_db),
):
    quote_id = await _get_quote_id(db, product_id)

    block = await db.get(CostBlock, block_id)
    if not block or block.product_id != product_id:
        raise HTTPException(404, "Cost block not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(block, field, value)

    await db.flush()
    quote = await recalculate_quote(db, quote_id)
    return QuoteRead.model_validate(quote)


@router.delete("/{block_id}", response_model=QuoteRead)
async def delete_cost_block(
    product_id: uuid.UUID,
    block_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    quote_id = await _get_quote_id(db, product_id)

    block = await db.get(CostBlock, block_id)
    if not block or block.product_id != product_id:
        raise HTTPException(404, "Cost block not found")

    await db.delete(block)
    await db.flush()

    quote = await recalculate_quote(db, quote_id)
    return QuoteRead.model_validate(quote)
