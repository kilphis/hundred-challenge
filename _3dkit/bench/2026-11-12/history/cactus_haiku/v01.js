window.MODELS = window.MODELS || {};

window.MODELS.cactus = function () {
  const g = new THREE.Group();

  // Helper function to create bumpy texture for cactus skin
  function createCactusTexture(width = 512, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Base green color (realistic cactus green)
    ctx.fillStyle = '#4a7c2a';
    ctx.fillRect(0, 0, width, height);

    // Add subtle bumpy texture using noise-like pattern
    ctx.fillStyle = '#5a8c3a';
    for (let i = 0; i < 800; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 8 + 2;
      ctx.globalAlpha = Math.random() * 0.3 + 0.1;
      ctx.fillRect(x, y, size, size);
    }

    // Add slight ridges/vertical lines for segmentation
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#3a5c1a';
    ctx.lineWidth = 2;
    for (let i = 0; i < width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + Math.sin(i * 0.1) * 10, height);
      ctx.stroke();
    }

    // Add some darker spots for variety
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#2a4c1a';
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 15 + 5;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2.5);
    return texture;
  }

  // Create spine clusters - small needles on cactus surface
  function createSpineCluster(position, direction) {
    const spineGroup = new THREE.Group();
    spineGroup.position.copy(position);

    // 3-4 small spines per cluster
    const spineCount = Math.random() < 0.5 ? 3 : 4;
    for (let i = 0; i < spineCount; i++) {
      const angle = (Math.PI * 2 * i) / spineCount + (Math.random() - 0.5) * 0.3;
      const spread = Math.random() * 0.2 - 0.1;

      // Create thin spine as cylinder
      const spineGeo = new THREE.ConeGeometry(0.15, 2.5, 8);
      const spineMat = new THREE.MeshStandardMaterial({
        color: 0xc4a040,
        roughness: 0.8,
        metalness: 0.1
      });
      const spine = new THREE.Mesh(spineGeo, spineMat);

      // Orient spine outward
      spine.position.x = Math.cos(angle) * spread;
      spine.position.y = spread;
      spine.position.z = Math.sin(angle) * spread;
      spine.rotation.z = angle;
      spine.rotation.x = Math.random() * 0.3 - 0.15;

      spine.castShadow = true;
      spine.receiveShadow = true;
      spineGroup.add(spine);
    }

    return spineGroup;
  }

  const cactusTexture = createCactusTexture(512, 512);

  const cactusMatGreen = new THREE.MeshStandardMaterial({
    map: cactusTexture,
    color: 0x5a8c3a,
    roughness: 0.7,
    metalness: 0.0
  });

  // === MAIN BODY ===
  // Lower bulge section (thicker base)
  const lowerBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(5, 12, 8, 16),
    cactusMatGreen
  );
  lowerBody.position.y = 8;
  lowerBody.scale.set(1, 0.9, 1);
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;
  g.add(lowerBody);

  // Main columnar body (upper section)
  const mainBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(5, 20, 8, 20),
    cactusMatGreen
  );
  mainBody.position.y = 18;
  mainBody.castShadow = true;
  mainBody.receiveShadow = true;
  g.add(mainBody);

  // Top section (tapers slightly)
  const topBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(4, 8, 8, 12),
    cactusMatGreen
  );
  topBody.position.y = 32;
  topBody.castShadow = true;
  topBody.receiveShadow = true;
  g.add(topBody);

  // === FLOWER (optional, at top) ===
  const flowerGeo = new THREE.IcosahedronGeometry(2, 2);
  const flowerMat = new THREE.MeshStandardMaterial({
    color: 0xffb347,
    roughness: 0.5,
    emissive: 0xff8c00,
    emissiveIntensity: 0.3
  });
  const flower = new THREE.Mesh(flowerGeo, flowerMat);
  flower.position.y = 38;
  flower.scale.set(1, 1.3, 1);
  flower.castShadow = true;
  flower.receiveShadow = true;
  g.add(flower);

  // === LEFT ARM ===
  const leftArmBase = new THREE.Mesh(
    new THREE.CapsuleGeometry(3.5, 15, 8, 12),
    cactusMatGreen
  );
  leftArmBase.position.set(-10, 20, 0);
  leftArmBase.rotation.z = Math.PI * 0.35;
  leftArmBase.castShadow = true;
  leftArmBase.receiveShadow = true;
  g.add(leftArmBase);

  // Left arm end cap
  const leftArmEnd = new THREE.Mesh(
    new THREE.SphereGeometry(3, 8, 8),
    cactusMatGreen
  );
  leftArmEnd.position.set(-20, 23, 0);
  leftArmEnd.castShadow = true;
  leftArmEnd.receiveShadow = true;
  g.add(leftArmEnd);

  // === RIGHT ARM ===
  const rightArmBase = new THREE.Mesh(
    new THREE.CapsuleGeometry(3.5, 15, 8, 12),
    cactusMatGreen
  );
  rightArmBase.position.set(10, 22, 0);
  rightArmBase.rotation.z = -Math.PI * 0.35;
  rightArmBase.castShadow = true;
  rightArmBase.receiveShadow = true;
  g.add(rightArmBase);

  // Right arm end cap
  const rightArmEnd = new THREE.Mesh(
    new THREE.SphereGeometry(3, 8, 8),
    cactusMatGreen
  );
  rightArmEnd.position.set(20, 25, 0);
  rightArmEnd.castShadow = true;
  rightArmEnd.receiveShadow = true;
  g.add(rightArmEnd);

  // === BACK ARM (smaller, higher up) ===
  const backArmBase = new THREE.Mesh(
    new THREE.CapsuleGeometry(3, 12, 8, 10),
    cactusMatGreen
  );
  backArmBase.position.set(0, 26, -9);
  backArmBase.rotation.x = Math.PI * 0.35;
  backArmBase.castShadow = true;
  backArmBase.receiveShadow = true;
  g.add(backArmBase);

  const backArmEnd = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 8, 8),
    cactusMatGreen
  );
  backArmEnd.position.set(0, 30, -15);
  backArmEnd.castShadow = true;
  backArmEnd.receiveShadow = true;
  g.add(backArmEnd);

  // === ADD SPINE CLUSTERS ===
  // Cluster positions on main body
  const spinePositions = [
    // Front
    new THREE.Vector3(0, 10, 5.5), new THREE.Vector3(0, 20, 5.5), new THREE.Vector3(0, 28, 5.5),
    // Back
    new THREE.Vector3(0, 10, -5.5), new THREE.Vector3(0, 20, -5.5), new THREE.Vector3(0, 28, -5.5),
    // Right
    new THREE.Vector3(5.5, 10, 0), new THREE.Vector3(5.5, 20, 0), new THREE.Vector3(5.5, 28, 0),
    // Left
    new THREE.Vector3(-5.5, 10, 0), new THREE.Vector3(-5.5, 20, 0), new THREE.Vector3(-5.5, 28, 0),
    // Diagonals front-right
    new THREE.Vector3(4, 15, 4), new THREE.Vector3(4, 25, 4),
    // Diagonals front-left
    new THREE.Vector3(-4, 15, 4), new THREE.Vector3(-4, 25, 4),
    // Diagonals back-right
    new THREE.Vector3(4, 15, -4), new THREE.Vector3(4, 25, -4),
    // Diagonals back-left
    new THREE.Vector3(-4, 15, -4), new THREE.Vector3(-4, 25, -4),
  ];

  spinePositions.forEach(pos => {
    const spines = createSpineCluster(pos, pos.normalize());
    g.add(spines);
  });

  // Spine clusters on arms
  const armSpinePositions = [
    new THREE.Vector3(-15, 20, 0),
    new THREE.Vector3(-18, 22, 0),
    new THREE.Vector3(15, 22, 0),
    new THREE.Vector3(18, 24, 0),
    new THREE.Vector3(0, 28, -12),
  ];

  armSpinePositions.forEach(pos => {
    const spines = createSpineCluster(pos, pos.normalize());
    g.add(spines);
  });

  return g;
};
