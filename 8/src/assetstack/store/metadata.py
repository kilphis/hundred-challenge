from datetime import datetime, timezone

from pydantic import BaseModel


class Metadata(BaseModel):
    request_id: str
    variant: str
    provider: str
    model: str = ""
    prompt: str
    refs: list[str]
    seed: int
    size: tuple[int, int]
    created_at: str = ""
    steps: list[str] = []      # 後処理の履歴
    file: str = ""

    def stamp(self) -> "Metadata":
        self.created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        return self
