import os
import re

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

import app.services.llm as llm
from app.db.session import database_url
from app.main import app
from app.services.frontend_auth import require_frontend_api_key


@pytest.fixture(autouse=True)
def allow_test_frontend_client():
    app.dependency_overrides[require_frontend_api_key] = lambda: None
    yield
    app.dependency_overrides.pop(require_frontend_api_key, None)


@pytest.fixture(autouse=True)
def reset_ai_cooldown():
    # Keep provider cooldown tests isolated while preserving cooldown behaviour
    # within each individual test.
    llm._AI_COOLDOWN_UNTIL = 0
    yield
    llm._AI_COOLDOWN_UNTIL = 0


@pytest.fixture(scope="session")
def test_engine():
    raw_url = os.environ.get("TEST_DATABASE_URL")
    if not raw_url:
        pytest.skip(
            "TEST_DATABASE_URL not set; skipping live PostgreSQL database tests"
        )
    engine = create_engine(database_url(raw_url), hide_parameters=True, pool_pre_ping=True)
    schema = os.environ.get("TEST_DATABASE_SCHEMA")
    if schema:
        if not re.fullmatch(r"reply_test_[a-f0-9]{32}", schema):
            raise ValueError("Invalid isolated test schema")

        @event.listens_for(engine, "begin")
        def isolate_transaction(connection):
            connection.exec_driver_sql(f'SET LOCAL search_path TO "{schema}"')

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
