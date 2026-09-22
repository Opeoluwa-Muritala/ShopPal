import os

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.session import database_url


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
