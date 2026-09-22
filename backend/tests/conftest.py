import os

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.session import database_url
from app.main import app
from app.services.frontend_auth import require_frontend_api_key


@pytest.fixture(autouse=True)
def allow_test_frontend_client():
    app.dependency_overrides[require_frontend_api_key] = lambda: None
    yield
    app.dependency_overrides.pop(require_frontend_api_key, None)


@pytest.fixture(scope="session")
def test_engine():
    raw_url = os.environ.get("TEST_DATABASE_URL")
    if not raw_url:
        pytest.skip(
            "TEST_DATABASE_URL not set; skipping live PostgreSQL database tests"
        )
    engine = create_engine(database_url(raw_url), hide_parameters=True)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(test_engine):
    with test_engine.connect() as connection:
        transaction = connection.begin()
        with Session(
            bind=connection, join_transaction_mode="create_savepoint"
        ) as session:
            yield session
        transaction.rollback()
