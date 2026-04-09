"""
Species router — view and price species assignments for a quote.

Species assignments are auto-created by the pipeline when hardwood/live-edge
products exist. The user sets price_per_bdft here; recalculation propagates
the price to all matching products' built-in species cost blocks.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Quote, SpeciesAssignment
from ..schemas import SpeciesAssignmentRead, SpeciesAssignmentUpdate, QuoteRead
from ..services.quote_service import recalculate_quote

router = APIRouter(prefix="/quotes/{quote_id}/species", tags=["species"])


async def _get_quote(db: AsyncSession, quote_id: uuid.UUID) -> Quote:
    quote = await db.get(Quote, quote_id)
    if not quote:
        raise HTTPException(404, "Quote not found")
    return quote


@router.get("", response_model=list[SpeciesAssignmentRead])
async def list_species(quote_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """List all species assignments for a quote (auto-created from product data)."""
    await _get_quote(db, quote_id)
    result = await db.execute(
        select(SpeciesAssignment)
        .where(SpeciesAssignment.quote_id == quote_id)
        .order_by(SpeciesAssignment.species_key)
    )
    return result.scalars().all()


@router.patch("/{species_key}", response_model=QuoteRead)
async def update_species_price(
    quote_id: uuid.UUID,
    species_key: str,
    data: SpeciesAssignmentUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Set the price per board foot for a species+thickness combination.
    Triggers full recalculation — all products using this species update immediately.
    """
    await _get_quote(db, quote_id)

    result = await db.execute(
        select(SpeciesAssignment).where(
            SpeciesAssignment.quote_id == quote_id,
            SpeciesAssignment.species_key == species_key,
        )
    )
    sa = result.scalar_one_or_none()
    if not sa:
        raise HTTPException(404, f"Species assignment '{species_key}' not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(sa, field, value)
    await db.flush()

    quote = await recalculate_quote(db, quote_id)
    return QuoteRead.model_validate(quote)
