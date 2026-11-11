# Face.png を 66x66 のマス目に落として grid.js に書き出す(file:// でも読めるように)
import json
from PIL import Image
N = 66
im = Image.open("Face.png").convert("RGBA")
bg = Image.new("RGBA", im.size, "white")
im = Image.alpha_composite(bg, im)  # 半透明の灰色・黄色を白の上に合成
s = im.width / N
rows = []
for y in range(N):
    row = []
    for x in range(N):
        r, g, b, a = im.getpixel((int((x + .5) * s), int((y + .5) * s)))
        row.append(None if (r > 250 and g > 250 and b > 250) else f"#{r:02x}{g:02x}{b:02x}")
    rows.append(row)
open("grid.js", "w").write("const GRID=" + json.dumps(rows) + ";")
