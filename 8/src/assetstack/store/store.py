"""画像は assets/raw/(git管理外)、メタデータは assets/meta/(追跡)に同名で置く。"""
from pathlib import Path

from .metadata import Metadata


class Store:
    def __init__(self, root: str | Path = "assets"):
        self.root = Path(root)

    def ref_path(self, ref_id: str) -> Path:
        return self.root / "refs" / f"{ref_id}.png"

    def save(self, png: bytes, meta: Metadata) -> Path:
        img = self.root / "raw" / meta.request_id / f"{meta.variant}.png"
        js = self.root / "meta" / meta.request_id / f"{meta.variant}.json"
        img.parent.mkdir(parents=True, exist_ok=True); js.parent.mkdir(parents=True, exist_ok=True)
        meta.file = str(img.relative_to(self.root))
        img.write_bytes(png)
        js.write_text(meta.stamp().model_dump_json(indent=2))
        return img
