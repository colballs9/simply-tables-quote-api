"""
Quote blocks router — CRUD for quote-level blocks + member management.
Every mutation triggers quote recalculation.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Quote, QuoteBlock, QuoteBlockMember, Product
from ..schemas import (
    QuoteBlockCreate, QuoteBlockUpdate, QuoteBlockRead,
    QuoteBlockMemberUpdate, QuoteBlockMemberRead,
    QuoteRead,
)
from ..services.quote_service import recalculate_quote

router = APIRouter(tags=["quote_blocks"])


# ── Block CRUD ────────────────────────────────────────────────────────

@router.post("/quotes/{quote_id}/blocks", response_model=QuoteRead, status_code=201)
async def create_block(
    quote_id: uuid.UUID,
    data: QuoteBlockCreate,
    db: AsyncSession = Depends(get_db),
):
    quote = await db.get(Quote, quote_id)
    if not quote:
        raise HTTPException(404, "Quote not found")

    block = QuoteBlock(
        quote_id=quote_id,
        tag_id=data.tag_id,
        sort_order=data.sort_order,
        is_active=data.is_active,
        block_domain=data.block_domain,
        block_type=data.block_type,
        label=data.label,
        cost_category=data.cost_category,
        cost_per_unit=data.cost_per_unit,
        units_per_product=data.units_per_product,
        multiplier_type=data.multiplier_type,
        labor_center=data.labor_center,
        rate_value=data.rate_value,
        metric_source=data.metric_source,
        rate_type=data.rate_type,
        hours_per_unit=data.hours_per_unit,
        total_amount=data.total_amount,
        total_hours=data.total_hours,
        distribution_type=data.distribution_type,
        on_qty_change=data.on_qty_change,
    )
    db.add(block)
    await db.flush()

    # Add initial members
    for pid in data.product_ids:
        product = await db.get(Product, pid)
        if not product:
            raise HTTPException(400, f"Product {pid} not found")
        member = QuoteBlockMember(quote_block_id=block.id, product_id=pid)
        db.add(member)

    await db.flush()
    result = await recalculate_quote(db, quote_id)
    return QuoteRead.model_validate(result)


@router.patch("/blocks/{block_id}", response_model=QuoteRead)
async def update_block(
    block_id: uuid.UUID,
    data: QuoteBlockUpdate,
    db: AsyncSession = Depends(get_db),
):
    block = await db.get(QuoteBlock, block_id)
    if not block:
        raise HTTPException(404, "Block not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(block, field, value)

    await db.flush()
    result = await recalculate_quote(db, block.quote_id)
    return QuoteRead.model_validate(result)


@router.delete("/blocks/{block_id}", response_model=QuoteRead)
async def delete_block(block_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    block = await db.get(QuoteBlock, block_id)
    if not block:
        raise HTTPException(404, "Block not found")

    quote_id = block.quote_id
    await db.delete(block)
    await db.flush()

    result = await recalculate_quote(db, quote_id)
    return QuoteRead.model_validate(result)


# ── Member management ─────────────────────────────────────────────────

@router.post("/blocks/{block_id}/members/{product_id}", response_model=QuoteRead)
async def add_member(
    block_id: uuid.UUID,
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    block = await db.get(QuoteBlock, block_id)
    if not block:
        raise HTTPException(404, "Block not found")

    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    member = QuoteBlockMember(quote_block_id=block_id, product_id=product_id)
    db.add(member)
    await db.flush()

    result = await recalculate_quote(db, block.quote_id)
    return QuoteRead.model_validate(result)


@router.patch("/blocks/{block_id}/members/{product_id}", response_model=QuoteRead)
async def update_member(
    block_id: uuid.UUID,
    product_id: uuid.UUID,
    data: QuoteBlockMemberUpdate,
    db: AsyncSession = Depends(get_db),
):
    block = await db.get(QuoteBlock, block_id)
    if not block:
        raise HTTPException(404, "Block not found")

    # Find the member
    member = None
    for m in block.members:
        if m.product_id == product_id:
            member = m
            break
    if not member:
        raise HTTPException(404, "Member not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(member, field, value)

    await db.flush()
    result = await recalculate_quote(db, block.quote_id)
    return QuoteRead.model_validate(result)


@router.delete("/blocks/{block_id}/members/{product_id}", response_model=QuoteRead)
async def remove_member(
    block_id: uuid.UUID,
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    block = await db.get(QuoteBlock, block_id)
    if not block:
        raise HTTPException(404, "Block not found")

    for member in block.members:
        if member.product_id == product_id:
            await db.delete(member)
            break
    else:
        raise HTTPException(404, "Member not found in block")

    await db.flush()
    result = await recalculate_quote(db, block.quote_id)
    return QuoteRead.model_validate(result)
