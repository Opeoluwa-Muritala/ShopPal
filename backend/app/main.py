from fastapi import FastAPI

from app.routers import health


def create_app() -> FastAPI:
    application = FastAPI(title="Naija Marketplace API")
    application.include_router(health.router)
    return application


app = create_app()
