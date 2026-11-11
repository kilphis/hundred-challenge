from typing import Protocol

class Provider(Protocol):
    def generate(self, prompt: str, refs: list[str], size: tuple[int, int], seed: int) -> bytes: ...
