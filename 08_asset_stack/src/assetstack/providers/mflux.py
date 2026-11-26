"""mflux(MLX)provider。Macでのみ動く。importは遅延させ、他環境でも本体がimportできるようにする。"""
import io


class MfluxProvider:
    def __init__(self, steps: int = 4):
        self.steps = steps
        self._model = None

    def _load(self):
        from mflux.models.common.config import ModelConfig
        from mflux.models.flux2.variants.txt2img.flux2_klein import Flux2Klein
        self._model = Flux2Klein(model_config=ModelConfig.flux2_klein_4b())

    def generate(self, prompt, refs, size, seed):
        if refs:
            raise NotImplementedError("参照画像付き編集は M0-2 の結果を見て実装する")
        if self._model is None:
            self._load()
        img = self._model.generate_image(seed=seed, prompt=prompt, num_inference_steps=self.steps,
                                         width=size[0], height=size[1])
        buf = io.BytesIO(); img.save(buf, "PNG")  # 戻り値の型は版で違う可能性あり
        return buf.getvalue()
