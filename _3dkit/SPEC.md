# 3Dモデル共通仕様(Three.js コードで組む方式)

day17 ネズミのゲームで使った仕様から、ゲーム固有の部分(部屋レイアウト)を外したもの。
ゲームごとの前提(配置・サイズ・当たり判定の要否)は、各日のフォルダに追加の SPEC を置いて上書きする。

## 技術
- Three.js r128(グローバル `THREE`。`<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js">`)。ES module は使わない(file:// で開くため)。
- 1ファイル = 担当モデル群。ファイルは自己完結。他のモデルファイルを読まない・書かない。
- 登録の形:
  ```js
  window.MODELS = window.MODELS || {};
  window.MODELS.cactus = function () { const g = new THREE.Group(); ...; return g; };
  ```
- 外部画像は使わない。質感は CanvasTexture で手続き的に描く(繰り返し、色ムラ、継ぎ目、汚れ)。
- マテリアルは MeshStandardMaterial / MeshPhysicalMaterial。ライトはモデルに入れない。光る部分は emissive。
- 全メッシュに `castShadow = true; receiveShadow = true`。
- 性能: 1モデルあたりメッシュ数 150 以下目安。同じ形が大量に並ぶなら InstancedMesh か手作りの結合。テクスチャは 1024px 以下。

## 座標と単位
- **1 = 1cm**。Y 上向き。原点 = 地面に接する足元の中心(底面 y=0)。正面は +Z を向く。
- 実物どおりの寸法にする。

## 当たり判定(ゲームで使う場合)
- `group.userData.colliders = [[minX,minY,minZ,maxX,maxY,maxZ], ...]`(ローカル座標の AABB)。

## プレビューと撮影(`70_hundred_challenge/_3dkit/`)
- ブラウザ: `preview.html?src=<jsのパス>&f=<関数名>`(ドラッグで回転)。`&col=1` で当たり判定を赤線表示。
- 撮影: `_3dkit/shot.sh <model.js> <関数名>` → jsと同じフォルダの `shots/<jsの名前>_{persp,front,side,top,close}.png`
- 任意カメラ: `_3dkit/shot.sh <model.js> <関数名> <名前> "cam=x,y,z&look=x,y,z"`
- 画面左上に寸法・底面の位置・メッシュ数が出る。底面が y=0 か、寸法が実物どおりかをここで確かめる。

## 描画設定
- 出力はリニアのまま(outputEncoding・toneMapping は既定)。色の16進指定は見たままの色で出る。
- ライト: HemisphereLight(0xfff6e8, 0x4a4038, 0.5) + 影付き DirectionalLight(0xfff1dc, 0.8) + 補助 PointLight 0.3。
