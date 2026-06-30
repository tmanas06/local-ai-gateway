import json
from typing import AsyncGenerator

import httpx

from config import get_settings
from gateway.providers.base import (
    BaseProvider,
    CompletionChunk,
    CompletionRequest,
    CompletionResponse,
)


def _count_tokens_rough(text: str) -> int:
    """Rough token estimate: ~4 chars per token."""
    return max(1, len(text) // 4)


class OllamaProvider(BaseProvider):
    name = "ollama"

    def __init__(self) -> None:
        self._base_url = get_settings().ollama_url

    def _build_messages(self, request: CompletionRequest) -> list[dict]:
        return [{"role": m.role, "content": m.content} for m in request.messages]

    async def complete(self, request: CompletionRequest) -> CompletionResponse:
        payload = {
            "model": request.model,
            "messages": self._build_messages(request),
            "stream": False,
            "options": {"temperature": request.temperature},
        }
        if request.max_tokens:
            payload["options"]["num_predict"] = request.max_tokens

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"{self._base_url}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()

        content = data["message"]["content"]
        prompt_text = " ".join(m.content for m in request.messages)

        return CompletionResponse(
            content=content,
            model=request.model,
            provider=self.name,
            input_tokens=_count_tokens_rough(prompt_text),
            output_tokens=_count_tokens_rough(content),
            finish_reason=data.get("done_reason", "stop"),
        )

    async def stream(self, request: CompletionRequest) -> AsyncGenerator[CompletionChunk, None]:
        payload = {
            "model": request.model,
            "messages": self._build_messages(request),
            "stream": True,
            "options": {"temperature": request.temperature},
        }
        if request.max_tokens:
            payload["options"]["num_predict"] = request.max_tokens

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", f"{self._base_url}/api/chat", json=payload) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    delta = chunk.get("message", {}).get("content", "")
                    done = chunk.get("done", False)
                    yield CompletionChunk(
                        delta=delta,
                        finish_reason="stop" if done else None,
                    )

    async def health_check(self, model: str) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self._base_url}/api/tags")
                if resp.status_code != 200:
                    return False
                models = [m["name"] for m in resp.json().get("models", [])]
                return any(model in m for m in models)
        except Exception:
            return False

    async def list_models(self) -> list[str]:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self._base_url}/api/tags")
                resp.raise_for_status()
                return [m["name"] for m in resp.json().get("models", [])]
        except Exception:
            return []

    async def list_detailed_models(self) -> list[dict]:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self._base_url}/api/tags")
                resp.raise_for_status()
                models = resp.json().get("models", [])
                
                # Also list active/loaded models from api/ps
                loaded_names = []
                try:
                    ps_resp = await client.get(f"{self._base_url}/api/ps")
                    if ps_resp.status_code == 200:
                        loaded_models = ps_resp.json().get("models", [])
                        loaded_names = [m["name"] for m in loaded_models]
                except Exception:
                    pass
                
                result = []
                for m in models:
                    name = m["name"]
                    details = m.get("details", {})
                    result.append({
                        "name": name,
                        "size": m.get("size", 0),
                        "family": details.get("family", "unknown"),
                        "quantization": details.get("quantization_level", "unknown"),
                        "parameter_size": details.get("parameter_size", "unknown"),
                        "loaded": any(name == lm or lm in name or name in lm for lm in loaded_names)
                    })
                return result
        except Exception:
            return []
