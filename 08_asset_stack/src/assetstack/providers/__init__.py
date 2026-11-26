def load_provider(name: str, cfg: dict):
    kind = cfg["providers"][name]["kind"]
    if kind == "mock":
        from .mock import MockProvider
        return MockProvider()
    if kind == "mflux":
        from .mflux import MfluxProvider
        return MfluxProvider(steps=cfg["providers"][name].get("steps", 4))
    raise NotImplementedError(f"provider '{kind}' は未実装")
