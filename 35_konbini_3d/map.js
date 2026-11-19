// map: マップ・歩ける判定・経路探索(bfs)・視線(los)。状態Gは触らない
// ==================== マップ ====================
// # 壁  . 床  d スタッフドア  b 裏口  p/r/s 部門の在庫棚(バックヤード)  F 冷凍庫  D ゴミ集積所
// C カート置き場  V 検品台  W トイレ  K カウンター  R フライヤー  H ホットケース  S 売り場の棚  T ゴミ箱  E 入口
const grid = [];
for (let y = 0; y < H; y++) { grid.push([]); for (let x = 0; x < W; x++) grid[y].push((x == 0 || y == 0 || x == W - 1 || y == H - 1) ? '#' : '.'); }
const set = (x, y, c) => grid[y][x] = c;
for (let x = 0; x < W; x++) set(x, 5, '#');
set(5, 5, 'd'); set(ALLEY_DOOR.x, ALLEY_DOOR.y, 'd');   // 売り場↔バックヤード / 売り場↔裏路地(飲料棚の横)
for (let y = 1; y <= 4; y++) set(15, y, '#');
set(15, 2, 'b');
[[13, 'F'], [14, 'F']].forEach(([x, c]) => set(x, 1, c));
const backSec = {};   // バックヤードの在庫棚タイル -> 売り場の商品(SECTIONS の番号)
BACK_POS.forEach(([x, y], i) => { set(x, y, SECTIONS[i].dept); backSec[y * W + x] = i; });
set(14, 3, 'C');   // カート置き場(バックヤード)
set(23, 1, 'D'); set(24, 1, 'D');
for (let y = 8; y <= 13; y++) set(2, y, 'K');
set(2, 8, 'R'); set(2, 11, 'H');
const secAt = {};
SECTIONS.forEach((s, i) => s.tiles.forEach(([x, y]) => { set(x, y, 'S'); secAt[y * W + x] = i; }));
set(15, 18, 'T');
set(11, 3, 'V');    // 検品台(バックヤード)
set(24, 17, 'W');   // トイレ
set(12, 19, 'E'); set(13, 19, 'E');

const tile = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? '#' : grid[y][x];
const isShelf = c => c == 'S';
const OPAQUE = new Set(['#', 'p', 'r', 's', 'F', 'S', 'd', 'b']);
const PLAYER_WALK = new Set(['.', 'd', 'b']);
const isManagerTile = (x, y) => x == Math.floor(MANAGER.x) && y == Math.floor(typeof G != 'undefined' && G && G.mgr ? G.mgr.y : MANAGER.y);
const inBackyard = (x, y) => (y >= 1 && y <= 4 && x >= 1 && x <= 14) || (x == 5 && y == 5);
const inAlley = (x, y) => y >= 1 && y <= 4 && x >= 16 && x <= 24;
const inStore = (x, y) => y >= 6 && y <= 19;   // 18(入口前の床)と19(入口 E)まで含める。壁かどうかは tile で見る
let dropsRef = [];   // 置いた荷物(G.drops)。カートだけが通行と視線をふさぐ
const dropAt = (x, y) => dropsRef.some(d => Math.floor(d.x) == x && Math.floor(d.y) == y);
const placedAt = (x, y) => dropsRef.some(d => d.carry.cart && Math.floor(d.x) == x && Math.floor(d.y) == y);   // 壁になるのはカートだけ。床の商品は通れる
const storeWalk = (x, y) => !placedAt(x, y) && inStore(x, y) && (tile(x, y) == '.' || tile(x, y) == 'E') && !isManagerTile(x, y);
// 巨大ゾンビは横3マスなので、壁・棚・機器から1マス離れた床だけ通れる(上下左右の隣がすべて床)。入口は1つ上の床で判定
const bigClear = (x, y) => { for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const t = tile(x + dx, y + dy);
  if (!inStore(x + dx, y + dy) || (t != '.' && t != 'E')) return false;
  } return true;
  };
const bigWalk = (x, y) => !isManagerTile(x, y) && (tile(x, y) == 'E' ? bigClear(x, y - 1) : inStore(x, y) && bigClear(x, y));
const alleyWalk = (x, y) => !placedAt(x, y) && inAlley(x, y) && tile(x, y) == '.';
const playerWalk = (x, y) => !placedAt(x, y) && PLAYER_WALK.has(tile(x, y)) && !isManagerTile(x, y);

// 区画 → 前に立てる床タイル
SECTIONS.forEach(s => s.spots = s.tiles.map(([x, y]) => ({ x: x + s.face, y, fx: x, fy: y })).filter(p => storeWalk(p.x, p.y)));

// ==================== 経路探索 ====================
function bfs(sx, sy, isGoal, pass) {
  const key = (x, y) => y * W + x;
  const prev = new Map(); prev.set(key(sx, sy), -1);
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    if (isGoal(x, y)) {
      const path = []; let k = key(x, y);
      while (k != -1) { path.push({ x: k % W, y: (k / W) | 0 }); k = prev.get(k); }
      path.reverse(); path.shift(); return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (!prev.has(k) && pass(nx, ny)) { prev.set(k, key(x, y)); q.push([nx, ny]); }
    }
  }
  return null;
}

// 視線: (x0,y0)→(x1,y1) が不透明タイルに遮られないか(タイル単位座標)
function los(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), n = Math.ceil(d / 0.1);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const tx = Math.floor(x0 + dx * t), ty = Math.floor(y0 + dy * t);
    if (OPAQUE.has(tile(tx, ty)) || placedAt(tx, ty)) return false;
  }
  return true;
}
function rayLen(x0, y0, a, max) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let d = 0.1; d <= max; d += 0.1) if (OPAQUE.has(tile(Math.floor(x0 + c * d), Math.floor(y0 + s * d)))) return d;
  return max;
}
