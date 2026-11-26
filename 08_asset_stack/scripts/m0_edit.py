"""M0-2: 基準画像から表情違いを作る(編集コマンドを呼ぶだけの薄いラッパ)。
実行: uv run --with mflux python scripts/m0_edit.py assets/refs/m0_base_seed1.png
※ フラグ名は `mflux-generate-flux2-edit --help` で確認して合わせること。
"""
import subprocess, sys, time

base = sys.argv[1]
for name in ["smile", "angry", "sad", "surprised"]:
    prompt = f"change only the facial expression to {name}; keep the same face, hairstyle, outfit, art style and background"
    t = time.time()
    subprocess.run(["mflux-generate-flux2-edit", "--image-paths", base, "--prompt", prompt,
                    "--seed", "1", "--output", f"assets/raw/m0_{name}.png"], check=True)
    print(f"{name} {time.time() - t:.1f}s")
