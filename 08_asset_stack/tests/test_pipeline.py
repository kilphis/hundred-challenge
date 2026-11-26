import json

import pytest
from PIL import Image

from assetstack.cli import main
from assetstack.request import Request


def _req(tmp_path, refs=""):
    p = tmp_path / "r.yaml"
    p.write_text(f"id: t\nsize: [64, 64]\nvariants: [smile, sad]\nseed: 7\nkeep: same face\n{refs}")
    return str(p)


def test_text_to_image_saves_image_and_metadata(tmp_path):
    main([_req(tmp_path), "--provider", "mock", "--assets", str(tmp_path / "a")])
    meta = json.loads((tmp_path / "a/meta/t/smile.json").read_text())
    assert meta["seed"] == 7 and meta["provider"] == "mock" and meta["file"] == "raw/t/smile.png"
    assert Image.open(tmp_path / "a/raw/t/sad.png").size == (64, 64)


def test_refs_missing_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        main([_req(tmp_path, "refs: [nope]\n"), "--provider", "mock", "--assets", str(tmp_path / "a")])


def test_prompt_with_refs_keeps_things():
    r = Request(id="x", refs=["b"], keep="same face", variants=["smile"])
    assert r.prompt_for("smile") == "change only the facial expression to smile; keep same face"
