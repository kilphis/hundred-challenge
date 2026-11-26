import argparse
from pathlib import Path

import yaml

from .pipeline import run
from .providers import load_provider
from .request import load_request
from .store.store import Store


def main(argv=None):
    ap = argparse.ArgumentParser(prog="assetstack")
    ap.add_argument("request")
    ap.add_argument("--provider")
    ap.add_argument("--config", default="config/providers.yaml")
    ap.add_argument("--assets", default="assets")
    a = ap.parse_args(argv)
    cfg = yaml.safe_load(Path(a.config).read_text())
    name = a.provider or cfg["default"]
    paths = run(load_request(a.request), load_provider(name, cfg), Store(a.assets), name,
                cfg["providers"][name].get("model", ""))
    for p in paths:
        print(p)


if __name__ == "__main__":
    main()
