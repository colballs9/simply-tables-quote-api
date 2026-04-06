"""
Catalog and material context routes — read-only lookups.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import StockBaseCatalog, MaterialContext
from ..schemas import CatalogItemRead, MaterialContextRead

router = APIRouter(tags=["catalog"])


# ──────────────────────────────────────────────────────────────────────
# Stock Base Catalog
# ──────────────────────────────────────────────────────────────────────

@router.get("/catalog", response_model=list[CatalogItemRead])
async def search_catalog(
    vendor: str | None = None,
    style: str | None = None,
    q: str | None = Query(None, description="Search across vendor + style"),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(StockBaseCatalog).where(StockBaseCatalog.is_active == True)

    if vendor:
        stmt = stmt.where(StockBaseCatalog.vendor.ilike(f"%{vendor}%"))
    if style:
        stmt = stmt.where(StockBaseCatalog.style.ilike(f"%{style}%"))
    if q:
        stmt = stmt.where(
            StockBaseCatalog.vendor.ilike(f"%{q}%")
            | StockBaseCatalog.style.ilike(f"%{q}%")
        )

    stmt = stmt.order_by(StockBaseCatalog.vendor, StockBaseCatalog.style).limit(100)
    result = await db.execute(stmt)
    return [CatalogItemRead.model_validate(item) for item in result.scalars().all()]


@router.get("/catalog/{item_id}", response_model=CatalogItemRead)
async def get_catalog_item(item_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    item = await db.get(StockBaseCatalog, item_id)
    if not item:
        raise HTTPException(404, "Catalog item not found")
    return CatalogItemRead.model_validate(item)


# ──────────────────────────────────────────────────────────────────────
# Material Context
# ──────────────────────────────────────────────────────────────────────

@router.get("/material-context", response_model=list[MaterialContextRead])
async def list_material_context(db: AsyncSession = Depends(get_db)):
    """All material types with their UI configuration and dropdown options."""
    result = await db.execute(select(MaterialContext))
    return [MaterialContextRead.model_validate(mc) for mc in result.scalars().all()]


@router.get("/material-context/{material_type}", response_model=MaterialContextRead)
async def get_material_context(material_type: str, db: AsyncSession = Depends(get_db)):
    stmt = select(MaterialContext).where(MaterialContext.material_type == material_type)
    result = await db.execute(stmt)
    mc = result.scalar_one_or_none()
    if not mc:
        raise HTTPException(404, f"No context for material type '{material_type}'")
    return MaterialContextRead.model_validate(mc)
