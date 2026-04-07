"""
System defaults router — read and update app-level default rates/margins.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import SystemDefaults
from ..schemas import SystemDefaultsRead, SystemDefaultsUpdate

router = APIRouter(prefix="/defaults", tags=["defaults"])


@router.get("", response_model=SystemDefaultsRead)
async def get_defaults(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemDefaults).where(SystemDefaults.key == "global"))
    defaults = result.scalar_one_or_none()
    if not defaults:
        raise HTTPException(404, "System defaults not found — run migration 006")
    return SystemDefaultsRead.model_validate(defaults)


@router.patch("", response_model=SystemDefaultsRead)
async def update_defaults(data: SystemDefaultsUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemDefaults).where(SystemDefaults.key == "global"))
    defaults = result.scalar_one_or_none()
    if not defaults:
        raise HTTPException(404, "System defaults not found — run migration 006")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(defaults, field, value)

    await db.commit()
    await db.refresh(defaults)
    return SystemDefaultsRead.model_validate(defaults)
