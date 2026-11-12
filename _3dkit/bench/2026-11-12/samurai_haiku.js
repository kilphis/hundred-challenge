window.MODELS = window.MODELS || {};
window.MODELS.samurai = function () {
  const g = new THREE.Group();
  g.scale.multiplyScalar(1.11); // 身長を170cmに調整

  // 手続きテクスチャ生成関数
  function makeCanvasTexture(width, height, drawFn) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    drawFn(ctx, width, height);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  // 着物テクスチャ（紫色にシボ感）
  const kimonoTex = makeCanvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#6b3fa0';
    ctx.fillRect(0, 0, 256, 256);
    // 織り目を表現
    ctx.fillStyle = '#5a2d8f';
    for (let y = 0; y < 256; y += 4) {
      for (let x = 0; x < 256; x += 3) {
        if ((x + y) % 8 < 4) ctx.fillRect(x, y, 2, 2);
      }
    }
  });

  // 羽織テクスチャ（黒）
  const haoriTex = makeCanvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 256, 256);
    // 微細な色ムラ
    for (let i = 0; i < 1000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#0d0d0d' : '#2a2a2a';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
    }
  });

  // 肌テクスチャ
  const skinTex = makeCanvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#e6c8b0';
    ctx.fillRect(0, 0, 128, 128);
    // わずかなそばかす感
    ctx.fillStyle = '#d4b59f';
    for (let i = 0; i < 200; i++) {
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
    }
  });

  // 刀身テクスチャ（銀色の反射感）
  const bladeTex = makeCanvasTexture(64, 256, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 64, 0);
    gradient.addColorStop(0, '#4a4a4a');
    gradient.addColorStop(0.3, '#e8e8e8');
    gradient.addColorStop(0.7, '#f5f5f5');
    gradient.addColorStop(1, '#a8a8a8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 256);
    // 焼き目表現
    ctx.fillStyle = '#8b7765';
    ctx.fillRect(0, 200, 64, 20);
  });

  // 刀身の装飾テクスチャ
  const kogugiTex = makeCanvasTexture(32, 64, (ctx) => {
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(0, 0, 32, 64);
    // 彫刻風の模様
    ctx.strokeStyle = '#aa8c2d';
    ctx.lineWidth = 1;
    for (let i = 0; i < 64; i += 8) {
      ctx.beginPath();
      ctx.arc(16, i + 4, 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  // マテリアル定義
  const kimonoMat = new THREE.MeshStandardMaterial({
    map: kimonoTex,
    roughness: 0.7,
    metalness: 0.0
  });

  const haoriMat = new THREE.MeshStandardMaterial({
    map: haoriTex,
    roughness: 0.8,
    metalness: 0.0
  });

  const skinMat = new THREE.MeshStandardMaterial({
    map: skinTex,
    roughness: 0.6,
    metalness: 0.0
  });

  const bladeMat = new THREE.MeshStandardMaterial({
    map: bladeTex,
    roughness: 0.2,
    metalness: 0.8
  });

  const kogugiMat = new THREE.MeshStandardMaterial({
    map: kogugiTex,
    roughness: 0.3,
    metalness: 0.7
  });

  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.8,
    metalness: 0.1
  });

  // 足（腰より下）
  const hips = new THREE.Group();

  // 下半身（着物の裾）
  const hakama = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 10, 45, 12),
    kimonoMat
  );
  hakama.position.y = 22.5;
  hakama.castShadow = true;
  hakama.receiveShadow = true;
  hips.add(hakama);

  // 足（左）- 走るポーズで前に出ている
  const leftLeg = new THREE.Group();
  const leftThigh = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 4.5, 35, 8),
    skinMat
  );
  leftThigh.position.y = 17.5;
  leftThigh.rotation.z = 0.6; // 前に蹴り出す
  leftThigh.castShadow = true;
  leftThigh.receiveShadow = true;
  leftLeg.add(leftThigh);

  const leftCalf = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4, 40, 8),
    skinMat
  );
  leftCalf.position.set(-3, -12, 8);
  leftCalf.rotation.z = 0.5;
  leftCalf.castShadow = true;
  leftCalf.receiveShadow = true;
  leftLeg.add(leftCalf);

  const leftFoot = new THREE.Mesh(
    new THREE.BoxGeometry(5, 3, 13),
    blackMat
  );
  leftFoot.position.set(-3, -30, 15);
  leftFoot.castShadow = true;
  leftFoot.receiveShadow = true;
  leftLeg.add(leftFoot);

  hips.add(leftLeg);

  // 足（右）- 走るポーズで後ろに引かれている
  const rightLeg = new THREE.Group();
  const rightThigh = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 4.5, 35, 8),
    skinMat
  );
  rightThigh.position.y = 17.5;
  rightThigh.rotation.z = -0.4; // 後ろに引かれる
  rightThigh.castShadow = true;
  rightThigh.receiveShadow = true;
  rightLeg.add(rightThigh);

  const rightCalf = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4, 40, 8),
    skinMat
  );
  rightCalf.position.set(3, -12, -5);
  rightCalf.rotation.z = -0.3;
  rightCalf.castShadow = true;
  rightCalf.receiveShadow = true;
  rightLeg.add(rightCalf);

  const rightFoot = new THREE.Mesh(
    new THREE.BoxGeometry(5, 3, 13),
    blackMat
  );
  rightFoot.position.set(3, -30, -8);
  rightFoot.castShadow = true;
  rightFoot.receiveShadow = true;
  rightLeg.add(rightFoot);

  hips.add(rightLeg);

  g.add(hips);

  // 体幹
  const torso = new THREE.Group();
  torso.position.y = 60;

  // 胴体（着物）
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(11, 12, 35, 12),
    kimonoMat
  );
  body.position.y = 0;
  body.castShadow = true;
  body.receiveShadow = true;
  torso.add(body);

  // 羽織（上に羽織る）
  const haori = new THREE.Mesh(
    new THREE.CylinderGeometry(12.5, 13, 38, 12),
    haoriMat
  );
  haori.position.y = 2;
  haori.castShadow = true;
  haori.receiveShadow = true;
  torso.add(haori);

  g.add(torso);

  // 首
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4.5, 8, 8),
    skinMat
  );
  neck.position.y = 96;
  neck.castShadow = true;
  neck.receiveShadow = true;
  g.add(neck);

  // 頭
  const head = new THREE.Group();
  head.position.y = 107;

  const headBase = new THREE.Mesh(
    new THREE.SphereGeometry(8, 12, 12),
    skinMat
  );
  headBase.castShadow = true;
  headBase.receiveShadow = true;
  head.add(headBase);

  // ちょんまげ（髪の毛）
  const chonmage = new THREE.Group();

  // 上部の結び目
  const topknot = new THREE.Mesh(
    new THREE.SphereGeometry(5, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 })
  );
  topknot.position.y = 8;
  topknot.scale.set(1, 1.2, 1);
  topknot.castShadow = true;
  topknot.receiveShadow = true;
  chonmage.add(topknot);

  // サイドの髪（頬の横）
  const sideHair1 = new THREE.Mesh(
    new THREE.SphereGeometry(3.5, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 })
  );
  sideHair1.position.set(-6, 1, 0);
  sideHair1.scale.set(1.2, 1.5, 0.8);
  sideHair1.castShadow = true;
  sideHair1.receiveShadow = true;
  chonmage.add(sideHair1);

  const sideHair2 = new THREE.Mesh(
    new THREE.SphereGeometry(3.5, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 })
  );
  sideHair2.position.set(6, 1, 0);
  sideHair2.scale.set(1.2, 1.5, 0.8);
  sideHair2.castShadow = true;
  sideHair2.receiveShadow = true;
  chonmage.add(sideHair2);

  head.add(chonmage);

  // 顔のディテール（目、鼻、口）
  const faceDetailMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });

  // 目
  const leftEye = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 6, 6),
    faceDetailMat
  );
  leftEye.position.set(-2.5, 2, 7.5);
  leftEye.castShadow = true;
  leftEye.receiveShadow = true;
  head.add(leftEye);

  const rightEye = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 6, 6),
    faceDetailMat
  );
  rightEye.position.set(2.5, 2, 7.5);
  rightEye.castShadow = true;
  rightEye.receiveShadow = true;
  head.add(rightEye);

  g.add(head);

  // 腕（右）- 刀を構えているので上げている
  const rightArm = new THREE.Group();
  rightArm.position.y = 88;

  const rightShoulder = new THREE.Mesh(
    new THREE.SphereGeometry(4.5, 8, 8),
    skinMat
  );
  rightShoulder.position.x = 13;
  rightShoulder.castShadow = true;
  rightShoulder.receiveShadow = true;
  rightArm.add(rightShoulder);

  const rightForearm = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 3, 32, 8),
    skinMat
  );
  rightForearm.position.set(13, -20, 8);
  rightForearm.rotation.z = 1.2; // 上向き
  rightForearm.castShadow = true;
  rightForearm.receiveShadow = true;
  rightArm.add(rightForearm);

  const rightHand = new THREE.Mesh(
    new THREE.SphereGeometry(3, 8, 8),
    skinMat
  );
  rightHand.position.set(20, -40, 20);
  rightHand.scale.set(0.9, 1, 1.2);
  rightHand.castShadow = true;
  rightHand.receiveShadow = true;
  rightArm.add(rightHand);

  g.add(rightArm);

  // 腕（左）- 走るポーズで少し張っている
  const leftArm = new THREE.Group();
  leftArm.position.y = 88;

  const leftShoulder = new THREE.Mesh(
    new THREE.SphereGeometry(4.5, 8, 8),
    skinMat
  );
  leftShoulder.position.x = -13;
  leftShoulder.castShadow = true;
  leftShoulder.receiveShadow = true;
  leftArm.add(leftShoulder);

  const leftForearm = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 3, 32, 8),
    skinMat
  );
  leftForearm.position.set(-13, -10, -5);
  leftForearm.rotation.z = -0.6;
  leftForearm.castShadow = true;
  leftForearm.receiveShadow = true;
  leftArm.add(leftForearm);

  const leftHand = new THREE.Mesh(
    new THREE.SphereGeometry(3, 8, 8),
    skinMat
  );
  leftHand.position.set(-18, -25, -12);
  leftHand.scale.set(0.9, 1, 1.2);
  leftHand.castShadow = true;
  leftHand.receiveShadow = true;
  leftArm.add(leftHand);

  g.add(leftArm);

  // 刀（刀身）- 右手が握っている
  const katana = new THREE.Group();
  katana.position.set(20, 50, 25);
  katana.rotation.set(-0.7, -0.3, 0.5); // 右斜め上に構える角度

  // 刀身（メインの刃）
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 80, 4),
    bladeMat
  );
  blade.castShadow = true;
  blade.receiveShadow = true;
  katana.add(blade);

  // 柄（持ち手）
  const tsuka = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 25, 8),
    new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.4,
      metalness: 0.1
    })
  );
  tsuka.position.y = -43;
  tsuka.castShadow = true;
  tsuka.receiveShadow = true;
  katana.add(tsuka);

  // 鍔（つば）- 金色の装飾的な円盤
  const tsuba = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5, 1, 16),
    kogugiMat
  );
  tsuba.position.y = -35;
  tsuba.castShadow = true;
  tsuba.receiveShadow = true;
  katana.add(tsuba);

  // 鍔の装飾パターン（内部の彫刻っぽく）
  const tsubaInner = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 3.5, 0.5, 12),
    new THREE.MeshStandardMaterial({
      color: 0x8b7355,
      roughness: 0.4,
      metalness: 0.5
    })
  );
  tsubaInner.position.y = -35.3;
  tsubaInner.castShadow = true;
  tsubaInner.receiveShadow = true;
  katana.add(tsubaInner);

  // 刀身の峰（みね）- 背側の線を明示
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 80, 1),
    bladeMat
  );
  spine.position.z = 2;
  spine.castShadow = true;
  spine.receiveShadow = true;
  katana.add(spine);

  g.add(katana);

  // シャドウ設定
  g.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  return g;
};
