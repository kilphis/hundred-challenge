from pathlib import Path

import yaml
from pydantic import BaseModel


class Request(BaseModel):
    id: str
    base_ref: str | None = None
    refs: list[str] = []
    size: tuple[int, int] = (1024, 1024)
    background: str = "plain"
    keep: str = ""
    prompt: str = ""           # base_ref なし(テキストから生成)のときの本文
    variants: list[str] = ["default"]
    seed: int = 1

    def prompt_for(self, variant: str) -> str:
        if self.refs:
            keep = f"; keep {self.keep}" if self.keep else ""
            return f"change only the facial expression to {variant}{keep}"
        return f"{self.prompt}, {variant}" if self.prompt else variant


def load_request(path: str | Path) -> Request:
    return Request(**yaml.safe_load(Path(path).read_text()))
