"""
Products router — add, update, delete products within a quote option.
Every mutation triggers quote recalculation.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Product, QuoteOption
from ..schemas import ProductCreate, ProductUpdate, ProductRead, QuoteRead
from ..services.quote_service import recalculate_quote, load_full_quote

router = APIRouter(prefix="/options/{option_id}/products", tags=["products"])


async def _get_quote_id(db: AsyncSession, option_id: uuid.UUID) -> uuid.UUID:
    """Resolve option → quote for recalculation."""
    option = await db.get(QuoteOption, option_id)
    if not option:
        raise HTTPException(404, "Option not found")
    return option.quote_id


@router.post("", response_model=QuoteRead, status_code=201)
async def add_product(option_id: uuid.UUID, data: ProductCreate, db: AsyncSession = Depends(get_db)):
    quote_id = await _get_quote_id(db, option_id)

    product = Product(option_id=option_id, **data.model_dump())
    db.add(product)
    await db.flush()

    quote = await recalculate_quote(db, quote_id)
    return QuoteRead.model_validate(quote)


@router.patch("/{product_id}", response_model=QuoteRead)
async def update_product(
    option_id: uuid.UUID,
    product_id: uuid.UUID,
    data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
):
    quote_id = await _get_quote_id(db, option_id)

    product = await db.get(Product, product_id)
    if not product or product.option_id != option_id:
        raise HTTPException(404, "Product not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    await db.flush()
    quote = await recalculate_quote(db, quote_id)
    return QuoteRead.model_validate(quote)


@router.delete("/{product_id}", response_model=QuoteRead)
async def delete_product(
    option_id: uuid.UUID,
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    quote_id = await _get_quote_id(db, option_id)

    product = await db.get(Product, product_id)
    if not product or product.option_id != option_id:
        raise HTTPException(404, "Product not found")

    await db.delete(product)
    await db.flush()

    quote = await recalculate_quote(db, quote_id)
    return QuoteRead.model_validate(quote)
