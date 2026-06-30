"""
Model router — decides which provider + model to use based on:
1. Explicit provider prefix in the model name (e.g. "ollama/gemma3:4b")
2. Code-heavy content → specialist coding model
3. Context-aware complexity scoring:
   - Multi-turn conversations with history → capable default model
   - Short, single-turn casual message → lightweight model
4. Default fallback (respects client-requested model)
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

# ── Heuristic constants ────────────────────────────────────────────────────────

_CODE_KEYWORDS = frozenset([
    "code", "function", "class", "def ", "import", "bug", "error",
    "syntax", "algorithm", "python", "javascript", "typescript",
    "rust", "golang", "sql", "bash", "script",
])

# A short single-turn conversation (last user message)
_SHORT_MSG_CHARS = 60

# Total user text across all turns above which we always use the default model
_COMPLEX_TOTAL_CHARS = 200

# Number of user turns above which we consider it a deep conversation
_MULTI_TURN_THRESHOLD = 2


def _user_messages(request: CompletionRequest) -> list[str]:
    """Return content of all user-role messages, oldest first."""
    return [m.content for m in request.messages if m.role == "user"]


def _last_user_message(request: CompletionRequest) -> str:
    msgs = _user_messages(request)
    return msgs[-1] if msgs else ""


def _conversation_complexity(request: CompletionRequest) -> dict:
    """
    Compute complexity signals across the full conversation history.
    Returns a dict with:
      - last_msg: str (latest user message)
      - last_msg_chars: int
      - user_turns: int (number of user messages)
      - total_user_chars: int (sum of all user message lengths)
      - has_history: bool (more than 1 user turn)
    """
    user_msgs = _user_messages(request)
    last_msg = user_msgs[-1] if user_msgs else ""
    total_chars = sum(len(m) for m in user_msgs)
    return {
        "last_msg": last_msg.lower(),
        "last_msg_chars": len(last_msg),
        "user_turns": len(user_msgs),
        "total_user_chars": total_chars,
        "has_history": len(user_msgs) > 1,
    }


def route(request: CompletionRequest) -> RoutingDecision:
    """
    Routing priority:
      1. Explicit "provider/model" prefix  → route to that provider directly
      2. Any message contains code keywords → qwen2.5-coder:7b (coding specialist)
      3. Multi-turn conversation OR complex total context → default capable model
      4. Short single-turn casual message  → phi4-mini:latest (fast lightweight)
      5. Default fallback → client-requested model (or settings default)
    """
    settings = get_settings()
    model_str = request.model or settings.default_model

    # ── Rule 1: Explicit provider/model override ───────────────────────────────
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

    # ── Analyse conversation complexity ───────────────────────────────────────
    cx = _conversation_complexity(request)

    # ── Rule 2: Code-heavy content in any message ──────────────────────────────
    all_user_text = " ".join(_user_messages(request)).lower()
    if any(kw in all_user_text for kw in _CODE_KEYWORDS):
        return RoutingDecision(
            provider=_ollama,
            model="qwen2.5-coder:7b",
            reason="code-related content detected",
        )

    # ── Rule 3: Multi-turn OR total context is substantial ────────────────────
    # Use the capable default model when the conversation has depth.
    # This avoids downgrading long conversations to a small model.
    if cx["has_history"] or cx["total_user_chars"] >= _COMPLEX_TOTAL_CHARS:
        return RoutingDecision(
            provider=_ollama,
            model=settings.default_model,
            reason=f"multi-turn or complex context ({cx['user_turns']} turns, {cx['total_user_chars']} chars)",
        )

    # ── Rule 4: Short single-turn casual greeting / simple question ───────────
    # Only fires when: no prior history + message is under threshold
    # AND client hasn't explicitly requested a specific non-default model.
    client_wants_default = (not request.model or request.model == settings.default_model)
    if client_wants_default and cx["last_msg_chars"] < _SHORT_MSG_CHARS:
        return RoutingDecision(
            provider=_ollama,
            model="phi4-mini:latest",
            reason=f"short single-turn message ({cx['last_msg_chars']} chars) → lightweight model",
        )

    # ── Default fallback ──────────────────────────────────────────────────────
    return RoutingDecision(
        provider=_ollama,
        model=model_str,
        reason="default routing",
    )


def get_provider(name: str) -> BaseProvider | None:
    return _PROVIDERS.get(name)


def get_all_providers() -> dict[str, BaseProvider]:
    return _PROVIDERS
