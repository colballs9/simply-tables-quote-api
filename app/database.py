"""
Database connection and session management.

Uses SQLAlchemy async with asyncpg driver.
Connection string configured via environment variable.

IMPORTANT: DATABASE_URL must use postgresql+asyncpg:// prefix.
If your env var uses postgresql://, it is auto-converted below.
"""

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

# Read and fix the DATABASE_URL
_raw_url = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/simply_tables"
)

# Auto-fix: if someone set postgresql:// without +asyncpg, fix it
if _raw_url.startswith("postgresql://"):
    DATABASE_URL = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif _raw_url.startswith("postgres://"):
    DATABASE_URL = _raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
else:
    DATABASE_URL = _raw_url

# Sync URL for Alembic (used when running alembic commands separately)
DATABASE_URL_SYNC = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

# Lazy engine — created on first use, not at import time
_engine = None
_async_session = None


def get_engine():
    """Get or create the async engine."""
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            DATABASE_URL,
            echo=os.getenv("SQL_ECHO", "false").lower() == "true",
            pool_size=5,
            max_overflow=10,
        )
    return _engine


def get_async_session():
    """Get or create the async session factory."""
    global _async_session
    if _async_session is None:
        engine = get_engine()
        _async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return _async_session


class Base(DeclarativeBase):
    pass


async def get_db():
    """FastAPI dependency — yields an async session, auto-closes."""
    session_factory = get_async_session()
    async with session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """
    Create tables if they don't exist.
    
    Uses SQLAlchemy metadata.create_all which is safe to run repeatedly —
    it only creates tables that don't already exist.
    
    For schema migrations, run Alembic separately:
        alembic upgrade head
    """
    try:
        engine = get_engine()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print(f"Database initialized successfully (connected to {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'local'})")
    except Exception as e:
        print(f"WARNING: Database init failed: {e}")
        print("The app will start but database operations will fail.")
        print(f"DATABASE_URL starts with: {DATABASE_URL[:30]}...")
