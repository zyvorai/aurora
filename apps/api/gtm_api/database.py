"""Database session management."""

from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from gtm_api.config import get_settings

settings = get_settings()
engine = create_async_engine(settings.database_url, echo=settings.debug, pool_pre_ping=True)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

DB_SETUP_HINT = (
    "PostgreSQL is not reachable. Start Docker Desktop, then run: "
    "cp .env.example .env && make infra-up && make init-db"
)


async def check_database() -> dict:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"db_ready": True, "db_message": None}
    except Exception as exc:
        return {
            "db_ready": False,
            "db_message": DB_SETUP_HINT,
            "db_error": str(exc),
        }


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
