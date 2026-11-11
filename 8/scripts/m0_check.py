"""M0: Mac上で klein 4B(mflux)の生成と所要時間を確認する。
実行: uv run --with mflux python scripts/m0_check.py
※ mfluxのAPIは版で変わる。動かなければ `uvx --from mflux mflux-generate-flux2 --help` で確認。
"""
import time
from pathlib import Path

from mflux.models.common.config import ModelConfig  # 版により import 先が違う可能性あり
from mflux.models.flux2.variants.txt2img.flux2_klein import Flux2Klein

PROMPT = "front view, neutral expression, plain gray background, original anime-style girl, short brown hair, blue jacket"
OUT = Path("assets/refs"); OUT.mkdir(parents=True, exist_ok=True)

model = Flux2Klein(model_config=ModelConfig.flux2_klein_4b())
for seed in (1, 2, 3):
    t = time.time()
    img = model.generate_image(seed=seed, prompt=PROMPT, num_inference_steps=4, width=1024, height=1024)
    img.save(OUT / f"m0_base_seed{seed}.png")
    print(f"seed={seed} {time.time() - t:.1f}s")
