"""Tags CRUD router — cost/labor allocation tags (Top, Base, Shipping, etc.)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models import Tag
from ..schemas import TagRead, TagCreate

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagRead])
async def list_tags(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tag).order_by(Tag.sort_order, Tag.name))
    return result.scalars().all()


@router.post("", response_model=TagRead, status_code=201)
async def create_tag(data: TagCreate, db: AsyncSession = Depends(get_db)):
    tag = Tag(name=data.name, category=data.category, is_default=data.is_default)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag
