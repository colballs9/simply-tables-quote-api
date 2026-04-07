"""
Quotes router — create, list, read, update, delete quotes.
On create: inherits default rates/margins from system_defaults.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Quote, QuoteOption, SystemDefaults
from ..schemas import QuoteCreate, QuoteUpdate, QuoteSummary, QuoteRead
from ..services.quote_service import load_full_quote, recalculate_quote

router = APIRouter(prefix="/quotes", tags=["quotes"])


@router.post("", response_model=QuoteRead, status_code=201)
async def create_quote(data: QuoteCreate, db: AsyncSession = Depends(get_db)):
    """Create a new quote with a default 'Standard' option.
    Inherits default rates/margins from system_defaults."""

    # Load system defaults for inheritance
    result = await db.execute(select(SystemDefaults).where(SystemDefaults.key == "global"))
    defaults = result.scalar_one_or_none()

    quote = Quote(
        deal_id=data.deal_id,
        project_name=data.project_name,
        quote_set=data.quote_set,
        version=data.version,
        has_rep=data.has_rep,
        rep_rate=data.rep_rate,
        status=data.status,
        drive_folder_id=data.drive_folder_id,
    )

    # Inherit from system defaults if available
    if defaults:
        quote.default_hourly_rate = defaults.hourly_rate
        quote.default_hardwood_margin_rate = defaults.hardwood_margin_rate
        quote.default_stone_margin_rate = defaults.stone_margin_rate
        quote.default_stock_base_margin_rate = defaults.stock_base_margin_rate
        quote.default_stock_base_ship_margin_rate = defaults.stock_base_ship_margin_rate
        quote.default_powder_coat_margin_rate = defaults.powder_coat_margin_rate
        quote.default_custom_base_margin_rate = defaults.custom_base_margin_rate
        quote.default_unit_cost_margin_rate = defaults.unit_cost_margin_rate
        quote.default_group_cost_margin_rate = defaults.group_cost_margin_rate
        quote.default_misc_margin_rate = defaults.misc_margin_rate
        quote.default_consumables_margin_rate = defaults.consumables_margin_rate

    db.add(quote)
    await db.flush()

    # Auto-create default option
    option = QuoteOption(quote_id=quote.id, name="Standard", sort_order=0)
    db.add(option)

    await db.commit()
    return await _read_quote(db, quote.id)


@router.get("", response_model=list[QuoteSummary])
async def list_quotes(
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Quote).order_by(Quote.updated_at.desc()).offset(offset).limit(limit)
    if status:
        stmt = stmt.where(Quote.status == status)
    result = await db.execute(stmt)
    quotes = result.scalars().all()
    return [
        QuoteSummary(
            id=q.id,
            deal_id=q.deal_id,
            project_name=q.project_name,
            quote_number=q.quote_number,
            status=q.status,
            has_rep=q.has_rep,
            total_price=q.total_price,
            total_hours=q.total_hours,
            created_at=q.created_at,
            updated_at=q.updated_at,
        )
        for q in quotes
    ]


@router.get("/{quote_id}", response_model=QuoteRead)
async def get_quote(quote_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await _read_quote(db, quote_id)


@router.patch("/{quote_id}", response_model=QuoteRead)
async def update_quote(quote_id: uuid.UUID, data: QuoteUpdate, db: AsyncSession = Depends(get_db)):
    quote = await db.get(Quote, quote_id)
    if not quote:
        raise HTTPException(404, "Quote not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(quote, field, value)

    await db.flush()

    # Recalculate if rep settings changed (affects sale price)
    if "has_rep" in update_data or "rep_rate" in update_data:
        quote = await recalculate_quote(db, quote_id)
    else:
        await db.commit()
        quote = await load_full_quote(db, quote_id)

    return _quote_to_response(quote)


@router.delete("/{quote_id}", status_code=204)
async def delete_quote(quote_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    quote = await db.get(Quote, quote_id)
    if not quote:
        raise HTTPException(404, "Quote not found")
    await db.delete(quote)
    await db.commit()


@router.post("/{quote_id}/recalculate", response_model=QuoteRead)
async def recalculate(quote_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Force full recalculation."""
    quote = await recalculate_quote(db, quote_id)
    if not quote:
        raise HTTPException(404, "Quote not found")
    return _quote_to_response(quote)


# ── Helpers ──

async def _read_quote(db: AsyncSession, quote_id: uuid.UUID) -> QuoteRead:
    quote = await load_full_quote(db, quote_id)
    if not quote:
        raise HTTPException(404, "Quote not found")
    return _quote_to_response(quote)


def _quote_to_response(quote: Quote) -> QuoteRead:
    return QuoteRead.model_validate(quote)
