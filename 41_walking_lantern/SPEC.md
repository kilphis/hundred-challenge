# day41 追加仕様 — 多脚の歩く彫刻 / 自由曲面シェル

共通仕様 `../_3dkit/SPEC.md` に従ったうえで、以下で上書き・追加する。

## A. 多脚の彫刻(sculpt_*.js)

### 寸法(1 = 1cm)
- 胴体の中心の高さ 400〜650、全高(膝の頂点か胴体の上端)は 1000 以下。
- 胴体は大きく(幅 260 以上)、脚は細く。脚の太さは **付け根 r=12〜18 → 膝 r≈半分 → 足先 r=2〜3**。
- 足先は y=0 に接する。足先の円(足を置く位置)は直径 800〜1300 程度。

### 脚の組み方(後で IK で歩かせるための決まり。必ず守る)
```
g (root。原点=胴体の真下の地面、+Z が正面)
 └ body (Group)                         g.userData.body
     └ hip_i (Object3D)  脚の付け根。body のローカル座標で胴体の外周に置く
         rotation.y = 脚の向き(ローカル +Z が足先の方向を水平に向く)
         └ femur_i (Object3D)  rotation.x = 上の骨の角度(+ で下向き、- で上向き)
             ├ 上の骨のメッシュ: (0,0,0) → (0,0,L1) の +Z 方向に伸びる
             └ knee_i (Object3D)  position = (0,0,L1)、rotation.x = 膝の角度
                 └ 下の骨のメッシュ: (0,0,0) → (0,0,L2)。z=L2 の先端が足先
```
- `g.userData.legs = [{hip, femur, knee, L1, L2, foot: THREE.Vector3}]`(foot は root ローカルの立ち姿勢の足先位置、y=0)。
- 骨のメッシュには `mesh.userData.seg = 1`(上)/ `2`(下)、`mesh.userData.leg = i` を付ける。後で曲げの大きさで色を塗るため、**骨のメッシュは骨1本につき1つ**、ローカル z=0〜L の範囲に収める(関節の玉・付け根の補強・足先の飾りは別メッシュでよい)。
- 膝は「付け根と足先を結ぶ線より上」に出す(クモ型)。上の骨が胴体にめり込まないよう、付け根は胴体の外周(赤道か下側の側面)に置く。
- 骨の作り方の例(テーパー付き):
  ```js
  const geo = new THREE.CylinderGeometry(rEnd, rRoot, L, 16, 8);
  geo.rotateX(Math.PI / 2);      // +Y → +Z(top=rEnd 側が +Z)
  geo.translate(0, 0, L / 2);    // z=0〜L
  ```
- 立ち姿勢は下の IK で決める(関数ごと自分のファイルにコピーしてよい):
  ```js
  function solveLeg(leg, targetWorld) {
    const p = leg.hip.parent.worldToLocal(targetWorld.clone()).sub(leg.hip.position);
    leg.hip.rotation.set(0, Math.atan2(p.x, p.z), 0);
    leg.hip.updateMatrixWorld(true);
    const t = leg.hip.worldToLocal(targetWorld.clone());          // t.x ≈ 0
    const L1 = leg.L1, L2 = leg.L2;
    const r = Math.min(Math.max(Math.hypot(t.y, t.z), Math.abs(L1 - L2) + 1e-3), L1 + L2 - 1e-3);
    const phi = Math.atan2(-t.y, t.z);                              // 足先への下向き角
    const alpha = Math.acos((L1 * L1 + r * r - L2 * L2) / (2 * L1 * r));
    const beta = Math.acos((L1 * L1 + L2 * L2 - r * r) / (2 * L1 * L2));
    leg.femur.rotation.x = phi - alpha;   // 膝を上に
    leg.knee.rotation.x = Math.PI - beta;
  }
  ```
  `g.updateMatrixWorld(true)` してから全脚に `solveLeg(leg, foot)` を呼ぶ。

### 見どころを形にする
- **脚の付け根**: 曲げが一番大きくなる場所。付け根を太くし、補強(カラー・リブ・ガセット板・リベットなど案ごとの形)を見せる。足先へ向かって細くなる(曲げは足先で0、付け根で最大)。
- 足先は細い点で接地(小さな円盤か尖り)。

### 性能
- メッシュ 150 以下。胴体は凝ってよいが、脚は1本あたり 6 メッシュ以下。

## B. 自由曲面シェル(shell.js)

- 1ファイルに3案: `window.MODELS.shell_a / shell_b / shell_c`。形を解くコードは共通の関数にまとめる。
- 寸法: 平面 2500〜4500、高さ 350〜700、厚み 20〜30(薄いコンクリートシェル)。原点 = 平面の中心の地面。
- 形の決め方(吊り下げ模型を逆さにする方法の近似): 平面の形を決め、支点(地面に着く部分)を数か所決め、
  `Δz = -1`(一様な荷重)を、支点で z=0、それ以外の縁は自由(法線方向の傾き0)として反復で解き、最大高さに合わせて拡大する。
  - 縁がガタガタにならないよう、平面の格子は輪郭に沿わせる(例: 星形の輪郭 R(θ) を極座標の格子で表す)。
  - 支点と支点の間の縁は平面で内側に弓なりにへこませる(アーチ状の開口になる)。
- 上面・下面(法線方向に厚み)・縁の側面を閉じたメッシュにする。白〜明るい灰色のコンクリート(打ち放しの細かい色ムラ、型枠の継ぎ目は無しか、ごく薄く)。
- `g.userData.info = {name, supports, span, height, thickness}`。
