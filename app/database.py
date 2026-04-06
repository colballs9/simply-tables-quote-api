"""
Database connection and session management.

Uses SQLAlchemy async with asyncpg driver.
Connection string configured via environment variable.
Runs Alembic migrations on startup.
"""

import os
import subprocess
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/simply_tables"
)

# For Alembic, use sync connection string
DATABASE_URL_SYNC = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
    pool_size=5,
    max_overflow=10,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    """FastAPI dependency — yields an async session, auto-closes."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Run Alembic migrations on startup."""
    try:
        # Run Alembic upgrade to latest
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            env={**os.environ, "DATABASE_URL": DATABASE_URL_SYNC},
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode != 0:
            print(f"Alembic upgrade failed: {result.stderr}")
            # Fallback to creating tables directly if Alembic fails
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        else:
            print("Database migrations completed successfully")

    except Exception as e:
        print(f"Error running migrations: {e}")
        # Fallback to creating tables directly
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

