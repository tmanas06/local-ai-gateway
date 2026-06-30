import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from auth.models import APIKey
from gateway.providers.base import CompletionResponse

def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "1.0.0"}

def test_model_routing_heuristics():
    from gateway.model_router import route
    from gateway.providers.base import CompletionRequest, Message
    
    # 1. Test explicit model routing raises ValueError for third-party, and routes ollama correctly
    with pytest.raises(ValueError) as excinfo:
        route(CompletionRequest(messages=[], model="openai/gpt-4o"))
    assert "not supported" in str(excinfo.value)

    req = CompletionRequest(messages=[], model="ollama/gemma3:4b")
    decision = route(req)
    assert decision.provider.name == "ollama"
    assert decision.model == "gemma3:4b"
    
    # 2. Test code keyword routing
    req = CompletionRequest(
        messages=[Message(role="user", content="write a python script to sort a list")],
        model="gemma3:4b"
    )
    decision = route(req)
    assert decision.model == "qwen2.5-coder:7b"
    
    # 3. Test short prompt routing
    req = CompletionRequest(
        messages=[Message(role="user", content="Hi")],
        model="gemma3:4b"
    )
    decision = route(req)
    assert decision.model == "phi4-mini:latest"

@pytest.mark.asyncio
async def test_chat_completions_unauthorized(client):
    response = client.post(
        "/v1/chat/completions",
        json={"model": "gemma3:4b", "messages": [{"role": "user", "content": "hello"}]}
    )
    assert response.status_code == 401  # Bearer authentication header missing

@pytest.mark.asyncio
async def test_chat_completions_success(client, monkeypatch, mock_db_and_redis):
    mock_mongo_db, mock_redis = mock_db_and_redis
    
    # 1. Mock API Key retrieval
    dummy_key = APIKey(
        id="test-key-id",
        name="test-key",
        org="test-org",
        key_hash="hashed-test-key",
        key_prefix="sk-test...",
        rate_limit_rpm=60
    )
    
    # We patch verify_api_key dependency directly or return the dummy key from get_api_key_by_hash
    async def mock_get_key(db, raw_key):
        return dummy_key
        
    monkeypatch.setattr("auth.dependencies.get_api_key_by_hash", mock_get_key)
    monkeypatch.setattr("auth.dependencies.touch_api_key", AsyncMock())
    
    # Mock Redis INCR for rate limiting
    mock_redis.incr = AsyncMock(return_value=1)
    
    # 2. Mock Ollama provider complete response
    mock_provider = AsyncMock()
    mock_provider.name = "ollama"
    mock_provider.complete = AsyncMock(return_value=CompletionResponse(
        content="This is a test response",
        model="gemma3:4b",
        provider="ollama",
        input_tokens=10,
        output_tokens=15
    ))
    
    # Replace in model router
    monkeypatch.setattr("gateway.model_router._ollama", mock_provider)
    
    # Run request
    headers = {"Authorization": "Bearer sk-test-key"}
    response = client.post(
        "/v1/chat/completions",
        headers=headers,
        json={"model": "gemma3:4b", "messages": [{"role": "user", "content": "tell me a joke"}]}
    )
    
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["choices"][0]["message"]["content"] == "This is a test response"
    assert res_data["usage"]["prompt_tokens"] == 10
    assert res_data["usage"]["completion_tokens"] == 15
