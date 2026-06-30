from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncGenerator


@dataclass
class Message:
    role: str   # "system" | "user" | "assistant"
    content: str


@dataclass
class CompletionRequest:
    messages: list[Message]
    model: str
    stream: bool = False
    temperature: float = 0.7
    max_tokens: int | None = None


@dataclass
class CompletionChunk:
    delta: str
    finish_reason: str | None = None


@dataclass
class CompletionResponse:
    content: str
    model: str
    provider: str
    input_tokens: int
    output_tokens: int
    finish_reason: str = "stop"


class BaseProvider(ABC):
    name: str

    @abstractmethod
    async def complete(self, request: CompletionRequest) -> CompletionResponse:
        """Non-streaming completion."""
        ...

    @abstractmethod
    async def stream(self, request: CompletionRequest) -> AsyncGenerator[CompletionChunk, None]:
        """Streaming completion — yields chunks."""
        ...

    @abstractmethod
    async def health_check(self, model: str) -> bool:
        """Return True if the model is available."""
        ...

    @abstractmethod
    async def list_models(self) -> list[str]:
        """Return list of available model names."""
        ...
