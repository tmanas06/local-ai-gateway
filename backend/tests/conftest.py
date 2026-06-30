import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

# Mock MongoDB and Redis modules before importing the app
import sys

# We will patch the database and redis client connections so we don't need real services running.
@pytest.fixture(autouse=True)
def mock_db_and_redis(monkeypatch):
    mock_mongo_db = MagicMock()
    mock_mongo_client = MagicMock()
    mock_mongo_client.__getitem__.return_type = mock_mongo_db
    
    # Mock Motor async methods on collections
    mock_collection = MagicMock()
    mock_collection.create_index = AsyncMock()
    mock_collection.insert_one = AsyncMock()
    mock_mongo_db.__getitem__.return_value = mock_collection
    mock_mongo_db.request_logs = mock_collection
    mock_mongo_db.api_keys = mock_collection
    
    # Mock database functions
    monkeypatch.setattr("database._client", mock_mongo_client)
    monkeypatch.setattr("database.connect_db", AsyncMock())
    monkeypatch.setattr("database.close_db", AsyncMock())
    monkeypatch.setattr("database.get_db", lambda: mock_mongo_db)
    
    # Mock Redis client
    mock_redis = MagicMock()
    mock_redis.incr = AsyncMock(return_value=1)
    mock_redis.expire = AsyncMock(return_value=True)
    mock_redis.ping = AsyncMock(return_value=True)
    monkeypatch.setattr("redis_client._redis", mock_redis)
    monkeypatch.setattr("redis_client.connect_redis", AsyncMock())
    monkeypatch.setattr("redis_client.close_redis", AsyncMock())
    monkeypatch.setattr("redis_client.get_redis", lambda: mock_redis)
    monkeypatch.setattr("auth.dependencies.get_redis", lambda: mock_redis)
    
    return mock_mongo_db, mock_redis

@pytest.fixture
def client():
    from main import app
    with TestClient(app) as c:
        yield c
