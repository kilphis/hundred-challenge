# /// script
# dependencies = ["numpy", "ripser"]
# ///
# 系 6.10 の検算: f = sqrt2 cos t を中心化・正規化したスライディングウィンドウ点群の最大持続性
import numpy as np
from ripser import ripser
for N in [2, 5, 10]:
    M = 2 * N; tau = 2 * np.pi / (M + 1)
    t = np.linspace(0, 2 * np.pi, 300, endpoint=False)
    X = np.stack([np.sqrt(2) * np.cos(t + m * tau) for m in range(M + 1)], 1)
    X = X - X.mean(1, keepdims=True); X /= np.linalg.norm(X, axis=1, keepdims=True)
    d = ripser(X)["dgms"][1]
    mp = (d[:, 1] - d[:, 0]).max()
    fhat = 1 / np.sqrt(2)
    print(f"N={N}: mp={mp:.4f}  sqrt3={np.sqrt(3):.4f}  原文の下界 2*sqrt3*|f^(1)|={2*np.sqrt(3)*fhat:.4f}  直した下界 sqrt6*|f^(1)|={np.sqrt(6)*fhat:.4f}")
