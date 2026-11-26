// 脚のしなり。骨のメッシュを、両端(関節)は動かさずに途中だけ弓なりに曲げる。
// 骨のローカル座標で z = 骨の向き、y = 脚の縦の面の中で骨に直角な向き。
//   上の骨: +y = 上(内)側 → 上に反るアーチ / 下の骨: +y = 外側 → 外へふくらむ
// 中心線のずれ c(z) は userData.curve に残し、bend.js が曲げの計算に使う。
(function () {
  const D = window.DEFS;

  // u = z/L(0〜1)。peak = いちばんふくらむ位置、p > 1 で両端の向きが骨の向きにそろう
  function makeCurve(L, def) {
    const k = Math.log(0.5) / Math.log(def.peak), A = def.amp * L, p = def.p;
    const f = z => { const u = Math.min(1, Math.max(0, z / L)); return A * Math.pow(Math.sin(Math.PI * Math.pow(u, k)), p); };
    const df = z => (f(Math.min(L, z + 0.5)) - f(Math.max(0, z - 0.5))) / (Math.min(L, z + 0.5) - Math.max(0, z - 0.5));
    return { f, df };
  }

  function curveLegs(model) {
    const legs = model.userData.legs;
    model.traverse(o => {
      if (!o.isMesh || !o.userData.seg) return;
      const leg = legs[o.userData.leg], L = o.userData.seg === 1 ? leg.L1 : leg.L2;
      const def = o.userData.seg === 1 ? D.curve.femur : D.curve.tibia;
      const c = makeCurve(L, def);
      o.geometry = o.geometry.clone();
      const pos = o.geometry.attributes.position, nor = o.geometry.attributes.normal;
      for (let k = 0; k < pos.count; k++) {
        const z = pos.getZ(k);
        pos.setY(k, pos.getY(k) + c.f(z));
        if (nor) {   // ずらし (x, y + c(z), z) に合わせて法線を回す: n' = (nx, ny, nz − c'(z)·ny)
          const nx = nor.getX(k), ny = nor.getY(k), nz = nor.getZ(k) - c.df(z) * ny, l = Math.hypot(nx, ny, nz) || 1;
          nor.setXYZ(k, nx / l, ny / l, nz / l);
        }
      }
      pos.needsUpdate = true; if (nor) nor.needsUpdate = true;
      o.geometry.computeBoundingSphere(); o.geometry.computeBoundingBox();
      o.userData.curve = c.f;
    });
  }

  window.CURVE = { curveLegs, makeCurve };
})();
