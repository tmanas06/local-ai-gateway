"""
Model router — decides which provider + model to use based on:
1. Explicit provider prefix in the model name (e.g. "ollama/gemma3:4b")
2. Content-based heuristics on the last user message
3. Default fallback
"""
from dataclasses import dataclass

from config import get_settings
from gateway.providers.base import BaseProvider, CompletionRequest
from gateway.providers.ollama import OllamaProvider


@dataclass
class RoutingDecision:
    provider: BaseProvider
    model: str
    reason: str


# Singletons — one per process
_ollama = OllamaProvider()

_PROVIDERS: dict[str, BaseProvider] = {
    "ollama": _ollama,
}

# Content heuristics
_CODE_KEYWORDS = frozenset([
    "code", "function", "class", "def ", "import", "bug", "error",
    "syntax", "algorithm", "python", "javascript", "typescript",
    "rust", "golang", "sql", "bash", "script",
])

_SHORT_PROMPT_THRESHOLD = 80   # characters in last user message


def _last_user_message(request: CompletionRequest) -> str:
    for msg in reversed(request.messages):
        if msg.role == "user":
            return msg.content
    return ""


def route(request: CompletionRequest) -> RoutingDecision:
    """
    Routing priority:
      1. Explicit "provider/model" prefix → use that provider (only 'ollama' is supported)
      2. Prompt looks like a coding question → qwen2.5-coder:7b via Ollama
      3. Short prompt → phi4-mini:latest via Ollama
      4. Default → settings.default_model via Ollama
    """
    settings = get_settings()
    model_str = request.model or settings.default_model

    # Rule 1: explicit "provider/model" syntax
    if "/" in model_str:
        provider_name, model_name = model_str.split("/", 1)
        if provider_name in _PROVIDERS:
            return RoutingDecision(
                provider=_PROVIDERS[provider_name],
                model=model_name,
                reason=f"explicit provider prefix '{provider_name}'",
            )
        else:
            raise ValueError(f"Provider '{provider_name}' is not supported. Only local 'ollama' is available.")

    # Rule 2: Code-heavy prompt
    last_msg = _last_user_message(request).lower()
    if any(kw in last_msg for kw in _CODE_KEYWORDS):
        return RoutingDecision(
            provider=_ollama,
            model="qwen2.5-coder:7b",
            reason="code-related prompt detected",
        )

    # Rule 3: Short prompt → lightweight model
    if len(last_msg) < _SHORT_PROMPT_THRESHOLD:
        return RoutingDecision(
            provider=_ollama,
            model="phi4-mini:latest",
            reason="short prompt → lightweight model",
        )

    # Default
    return RoutingDecision(
        provider=_ollama,
        model=settings.default_model,
        reason="default routing",
    )


def get_provider(name: str) -> BaseProvider | None:
    return _PROVIDERS.get(name)


def get_all_providers() -> dict[str, BaseProvider]:
    return _PROVIDERS
