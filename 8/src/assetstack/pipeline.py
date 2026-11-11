from .request import Request
from .store.metadata import Metadata
from .store.store import Store


def run(req: Request, provider, store: Store, provider_name: str, model: str = "") -> list:
    refs = [str(store.ref_path(r)) for r in req.refs]
    missing = [r for r in refs if not __import__("pathlib").Path(r).exists()]
    if missing:
        raise FileNotFoundError(f"参照画像がない: {missing}")
    out = []
    for v in req.variants:
        prompt = req.prompt_for(v)
        png = provider.generate(prompt, refs, req.size, req.seed)
        out.append(store.save(png, Metadata(request_id=req.id, variant=v, provider=provider_name, model=model,
                                            prompt=prompt, refs=req.refs, seed=req.seed, size=req.size)))
    return out
