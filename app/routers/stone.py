"""
Stone assignments router — quote-level stone pricing.

Provides read access to computed stone_assignment totals and lets the user
set total_cost per stone type, which triggers a full recalculation.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models import StoneAssignment, Quote
from ..schemas import StoneAssignmentRead, StoneAssignmentUpdate, QuoteRead
from ..services.quote_service import recalculate_quote

router = APIRouter(tags=["stone"])


@router.get("/quotes/{quote_id}/stone", response_model=list[StoneAssignmentRead])
async def list_stone_assignments(
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StoneAssignment).where(StoneAssignment.quote_id == quote_id)
    )
    return result.scalars().all()


@router.patch("/quotes/{quote_id}/stone/{stone_key:path}", response_model=QuoteRead)
async def update_stone_assignment(
    quote_id: uuid.UUID,
    stone_key: str,
    data: StoneAssignmentUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Set total_cost for a stone type and recalculate."""
    result = await db.execute(
        select(StoneAssignment).where(
            StoneAssignment.quote_id == quote_id,
            StoneAssignment.stone_key == stone_key,
        )
    )
    sa = result.scalar_one_or_none()
    if not sa:
        raise HTTPException(404, f"Stone assignment '{stone_key}' not found for this quote")

    sa.total_cost = data.total_cost
    await db.flush()

    quote = await recalculate_quote(db, quote_id)
    if not quote:
        raise HTTPException(404, "Quote not found")
    return QuoteRead.model_validate(quote)
