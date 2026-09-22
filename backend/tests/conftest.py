import pytest
from typing import Generator

@pytest.fixture
def db_session() -> Generator:
    """
    Placeholder fixture stub for database test session.
    No application or business logic. To be wired with test database or transactional rollback.
    """
    session = {"connected": True, "type": "mock_db_session"}
    yield session
    # Teardown logic stub
    session["connected"] = False
