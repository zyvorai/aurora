"""Public license status endpoint (reachable even when the trial has expired)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.config import get_settings
from gtm_api.database import get_db
from gtm_api.services import licensing

router = APIRouter(prefix="/license", tags=["license"])


@router.get("/status")
async def license_status(db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    st = await licensing.status(db, settings.aurora_license_key or None)
    return st.as_dict()
