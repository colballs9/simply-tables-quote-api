"""
Product components router — Material Builder CRUD.

Each product can have plank, leg, apron, metal_part, or other components
that contribute bdft/sqft to the species pipeline and panel data pipeline.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models import Product, ProductComponent, QuoteOption
from ..schemas import ComponentCreate, ComponentUpdate, QuoteRead
from ..services.quote_service import recalculate_quote

router = APIRouter(prefix="/products/{product_id}/components", tags=["components"])


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
async def add_component(
    product_id: uuid.UUID,
    data: ComponentCreate,
    db: AsyncSession = Depends(get_db),
):
    quote_id = await _get_quote_id(db, product_id)

    component = ProductComponent(product_id=product_id, **data.model_dump())
    db.add(component)
    await db.flush()

    quote = await recalculate_quote(db, quote_id)
    return QuoteRead.model_validate(quote)


@router.patch("/{component_id}", response_model=QuoteRead)
async def update_component(
    product_id: uuid.UUID,
    component_id: uuid.UUID,
    data: ComponentUpdate,
    db: AsyncSession = Depends(get_db),
):
    quote_id = await _get_quote_id(db, product_id)

    component = await db.get(ProductComponent, component_id)
    if not component or component.product_id != product_id:
        raise HTTPException(404, "Component not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(component, field, value)

    await db.flush()
    quote = await recalculate_quote(db, quote_id)
    return QuoteRead.model_validate(quote)


@router.delete("/{component_id}", response_model=QuoteRead)
async def delete_component(
    product_id: uuid.UUID,
    component_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    quote_id = await _get_quote_id(db, product_id)

    component = await db.get(ProductComponent, component_id)
    if not component or component.product_id != product_id:
        raise HTTPException(404, "Component not found")

    await db.delete(component)
    await db.flush()

    quote = await recalculate_quote(db, quote_id)
    return QuoteRead.model_validate(quote)
