import io
from PIL import Image

class MockProvider:
    def generate(self, prompt, refs, size, seed):
        buf = io.BytesIO(); Image.new("RGB", size, (seed % 256, 120, 180)).save(buf, "PNG")
        return buf.getvalue()
