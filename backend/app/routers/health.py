from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["System"])


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
