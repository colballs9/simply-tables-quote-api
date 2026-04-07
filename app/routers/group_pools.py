"""
Group pools router — manage group cost pools and group labor pools.
These live at the quote level and distribute across products.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import (
    Quote, GroupCostPool, GroupCostPoolMember,
    GroupLaborPool, GroupLaborPoolMember, Product,
)
from ..schemas import (
    GroupCostPoolCreate, GroupCostPoolUpdate, GroupCostPoolRead,
    GroupLaborPoolCreate, GroupLaborPoolUpdate, GroupLaborPoolRead,
    QuoteRead,
)
from ..services.quote_service import recalculate_quote

router = APIRouter(tags=["group_pools"])


# ──────────────────────────────────────────────────────────────────────
# Group Cost Pools
# ──────────────────────────────────────────────────────────────────────

@router.post("/quotes/{quote_id}/group-cost-pools", response_model=QuoteRead, status_code=201)
async def create_group_cost_pool(
    quote_id: uuid.UUID,
    data: GroupCostPoolCreate,
    db: AsyncSession = Depends(get_db),
):
    quote = await db.get(Quote, quote_id)
    if not quote:
        raise HTTPException(404, "Quote not found")

    pool = GroupCostPool(
        quote_id=quote_id,
        tag_id=data.tag_id,
        sort_order=data.sort_order,
        cost_category=data.cost_category,
        description=data.description,
        total_amount=data.total_amount,
        distribution_type=data.distribution_type,
        on_qty_change=data.on_qty_change,
    )
    db.add(pool)
    await db.flush()

    # Add members
    for pid in data.product_ids:
        product = await db.get(Product, pid)
        if not product:
            raise HTTPException(400, f"Product {pid} not found")
        member = GroupCostPoolMember(pool_id=pool.id, product_id=pid)
        db.add(member)

    await db.flush()
    result = await recalculate_quote(db, quote_id)
    return QuoteRead.model_validate(result)


@router.patch("/group-cost-pools/{pool_id}", response_model=QuoteRead)
async def update_group_cost_pool(
    pool_id: uuid.UUID,
    data: GroupCostPoolUpdate,
    db: AsyncSession = Depends(get_db),
):
    pool = await db.get(GroupCostPool, pool_id)
    if not pool:
        raise HTTPException(404, "Pool not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(pool, field, value)

    await db.flush()
    result = await recalculate_quote(db, pool.quote_id)
    return QuoteRead.model_validate(result)


@router.delete("/group-cost-pools/{pool_id}", response_model=QuoteRead)
async def delete_group_cost_pool(pool_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    pool = await db.get(GroupCostPool, pool_id)
    if not pool:
        raise HTTPException(404, "Pool not found")

    quote_id = pool.quote_id
    await db.delete(pool)
    await db.flush()

    result = await recalculate_quote(db, quote_id)
    return QuoteRead.model_validate(result)


@router.post("/group-cost-pools/{pool_id}/members/{product_id}", response_model=QuoteRead)
async def add_pool_member(
    pool_id: uuid.UUID,
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    pool = await db.get(GroupCostPool, pool_id)
    if not pool:
        raise HTTPException(404, "Pool not found")

    member = GroupCostPoolMember(pool_id=pool_id, product_id=product_id)
    db.add(member)
    await db.flush()

    result = await recalculate_quote(db, pool.quote_id)
    return QuoteRead.model_validate(result)


@router.delete("/group-cost-pools/{pool_id}/members/{product_id}", response_model=QuoteRead)
async def remove_pool_member(
    pool_id: uuid.UUID,
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    pool = await db.get(GroupCostPool, pool_id)
    if not pool:
        raise HTTPException(404, "Pool not found")

    # Find and delete the member
    for member in pool.members:
        if member.product_id == product_id:
            await db.delete(member)
            break
    else:
        raise HTTPException(404, "Member not found in pool")

    await db.flush()
    result = await recalculate_quote(db, pool.quote_id)
    return QuoteRead.model_validate(result)


# ──────────────────────────────────────────────────────────────────────
# Group Labor Pools — same pattern
# ──────────────────────────────────────────────────────────────────────

@router.post("/quotes/{quote_id}/group-labor-pools", response_model=QuoteRead, status_code=201)
async def create_group_labor_pool(
    quote_id: uuid.UUID,
    data: GroupLaborPoolCreate,
    db: AsyncSession = Depends(get_db),
):
    quote = await db.get(Quote, quote_id)
    if not quote:
        raise HTTPException(404, "Quote not found")

    pool = GroupLaborPool(
        quote_id=quote_id,
        tag_id=data.tag_id,
        sort_order=data.sort_order,
        labor_center=data.labor_center,
        description=data.description,
        total_hours=data.total_hours,
        distribution_type=data.distribution_type,
        on_qty_change=data.on_qty_change,
    )
    db.add(pool)
    await db.flush()

    for pid in data.product_ids:
        member = GroupLaborPoolMember(pool_id=pool.id, product_id=pid)
        db.add(member)

    await db.flush()
    result = await recalculate_quote(db, quote_id)
    return QuoteRead.model_validate(result)


@router.patch("/group-labor-pools/{pool_id}", response_model=QuoteRead)
async def update_group_labor_pool(
    pool_id: uuid.UUID,
    data: GroupLaborPoolUpdate,
    db: AsyncSession = Depends(get_db),
):
    pool = await db.get(GroupLaborPool, pool_id)
    if not pool:
        raise HTTPException(404, "Pool not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(pool, field, value)

    await db.flush()
    result = await recalculate_quote(db, pool.quote_id)
    return QuoteRead.model_validate(result)


@router.delete("/group-labor-pools/{pool_id}", response_model=QuoteRead)
async def delete_group_labor_pool(pool_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    pool = await db.get(GroupLaborPool, pool_id)
    if not pool:
        raise HTTPException(404, "Pool not found")

    quote_id = pool.quote_id
    await db.delete(pool)
    await db.flush()

    result = await recalculate_quote(db, quote_id)
    return QuoteRead.model_validate(result)


@router.post("/group-labor-pools/{pool_id}/members/{product_id}", response_model=QuoteRead)
async def add_labor_pool_member(
    pool_id: uuid.UUID,
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    pool = await db.get(GroupLaborPool, pool_id)
    if not pool:
        raise HTTPException(404, "Pool not found")

    member = GroupLaborPoolMember(pool_id=pool_id, product_id=product_id)
    db.add(member)
    await db.flush()

    result = await recalculate_quote(db, pool.quote_id)
    return QuoteRead.model_validate(result)


@router.delete("/group-labor-pools/{pool_id}/members/{product_id}", response_model=QuoteRead)
async def remove_labor_pool_member(
    pool_id: uuid.UUID,
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    pool = await db.get(GroupLaborPool, pool_id)
    if not pool:
        raise HTTPException(404, "Pool not found")

    for member in pool.members:
        if member.product_id == product_id:
            await db.delete(member)
            break
    else:
        raise HTTPException(404, "Member not found in pool")

    await db.flush()
    result = await recalculate_quote(db, pool.quote_id)
    return QuoteRead.model_validate(result)
