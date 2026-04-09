"""CRUD for product description items (details + exceptions)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Product, ProductDescriptionItem, QuoteOption
from ..schemas import DescriptionItemCreate, DescriptionItemRead, DescriptionItemUpdate, QuoteRead
from ..services.quote_service import load_full_quote

router = APIRouter(prefix="/products/{product_id}/description-items", tags=["description_items"])


async def _get_quote_id(db: AsyncSession, product_id):
    """Resolve product → option → quote."""
    result = await db.execute(
        select(Product).where(Product.id == product_id).options(selectinload(Product.option))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product.option.quote_id


@router.post("", response_model=QuoteRead, status_code=201)
async def add_description_item(product_id: str, data: DescriptionItemCreate, db: AsyncSession = Depends(get_db)):
    quote_id = await _get_quote_id(db, product_id)
    item = ProductDescriptionItem(
        product_id=product_id,
        section=data.section,
        item_type=data.item_type,
        content=data.content,
        sort_order=data.sort_order,
    )
    db.add(item)
    await db.commit()
    quote = await load_full_quote(db, quote_id)
    return quote


@router.patch("/{item_id}", response_model=QuoteRead)
async def update_description_item(product_id: str, item_id: str, data: DescriptionItemUpdate, db: AsyncSession = Depends(get_db)):
    quote_id = await _get_quote_id(db, product_id)
    result = await db.execute(
        select(ProductDescriptionItem).where(
            ProductDescriptionItem.id == item_id,
            ProductDescriptionItem.product_id == product_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Description item not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)

    await db.commit()
    quote = await load_full_quote(db, quote_id)
    return quote


@router.delete("/{item_id}", response_model=QuoteRead)
async def delete_description_item(product_id: str, item_id: str, db: AsyncSession = Depends(get_db)):
    quote_id = await _get_quote_id(db, product_id)
    result = await db.execute(
        select(ProductDescriptionItem).where(
            ProductDescriptionItem.id == item_id,
            ProductDescriptionItem.product_id == product_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Description item not found")

    await db.delete(item)
    await db.commit()
    quote = await load_full_quote(db, quote_id)
    return quote
