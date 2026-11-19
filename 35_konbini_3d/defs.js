// defs: 数値・部門・棚・シフトの定義。調整で変わるものはここに集める(ロジックは書かない)
const TS = 36, W = 26, H = 20, HUD = 56, BOT = 64;
const REAL_SEC_PER_GAME_HOUR = 40;            // ゲーム内1時間 = 実時間40秒
const GMIN_PER_SEC = 60 / REAL_SEC_PER_GAME_HOUR;

// バックヤードのカートを引き出し、在庫棚の商品を積んで、売り場の細かい棚を回って補充する
const DEPTS = { p: { name: '食料品', color: '#e8b04b' }, r: { name: '日用品', color: '#6bb0e8' }, s: { name: '飲料', color: '#59c96b' } };
// 売り場の棚(区画)。tiles は棚タイル、face は客と店員が立つ側(dx)
const SECTIONS = [];
function addSec(name, dept, color, col, y0, y1, face) {
  const tiles = []; for (let y = y0; y <= y1; y++) tiles.push([col, y]);
  SECTIONS.push({ name, dept, color, tiles, face });
}
[ // ゴンドラ1・2は食料品、3は日用品
  [7, 'おにぎり', '#f4f2e6', 'サンド', '#f0d890', '弁当', '#d8573c', 'パン', '#d9a35b', 'p'],
  [12, 'ヨーグルト', '#ffffff', 'カップ麺', '#e2cf3a', 'スナック', '#e8743b', 'チョコ', '#7a4a2a', 'p'],
  [17, '洗剤', '#5fb5e8', 'ティッシュ', '#e8e8f8', '電池', '#c0c0c0', '歯ブラシ', '#e86bb0', 'r'],
].forEach(([gx, a, ac, b, bc, c, cc, d, dc, dept]) => {
  addSec(a, dept, ac, gx, 9, 12, -1); addSec(b, dept, bc, gx, 13, 15, -1);
  addSec(c, dept, cc, gx + 1, 9, 12, 1); addSec(d, dept, dc, gx + 1, 13, 15, 1);
});
addSec('お茶', 's', '#6aa84f', 24, 8, 9, -1); addSec('水', 's', '#a8d8f0', 24, 10, 11, -1);
addSec('コーヒー', 's', '#6b4a32', 24, 12, 13, -1); addSec('ジュース', 's', '#f0a030', 24, 14, 15, -1);
const TILE_MAX = 3 /* 1ブロックの在庫 */, HOT_MAX = 8, HOT_ADD = 4, TRASH_MAX = 6, FRY_TIME = 8;
const MANAGER = { x: 1.5, y: 10.5 };   // レジに立つ店長ゾンビ(タイル(1,10)を占める)
// 店員ゾンビ(店のゾンビ従業員)。仕事は遅く、順番が人間と逆。プレイヤーに気づけば追ってくる(客ゾンビは店員を襲わない=もともと客同士は襲わない)
// バックヤードが安全なのは客ゾンビに対してだけ。店員ゾンビは入ってくる
const STAFF = {
  speed: 0.9, chase: 2.4,                  // 歩く速さ(客は1.0〜1.35) / 追跡(プレイヤー3.3・荷物ありは2.0)
  startDaze: 20, noWork: [1.5, 3],         // 開始直後、同じバックヤードのプレイヤーに気づかずぼーっとする秒 / 仕事が無いとき次を探すまでの秒
  skip: 12,                                // 道が無い仕事を諦める秒
  work: { trash: 3.0, bin: 1.5, fry: 2.5, toilet: 5.0, tidy: 3.5, mop: 1.2, take: 1.8, refill: 1.6 },   // 作業にかかる秒(プレイヤーはだいたい0.5〜2)。床はモップをかけて歩く
  order: ['hot', 'toilet', 'tidy', 'spill', 'trash', 'refill'],   // 優先順位。見た目に出る仕事が先で、ゴミ捨てと欠品の補充が最後
  refillMin: 0.6, carry: 3,                // 補充は「在庫が6割以上ある棚」だけ(欠品の棚は放置) / 1回に持つ個数
  shirt: '#2b5fa8', skin: '#7a9a62',       // 制服の色(店長と同じ青)
};
const ALLEY_DOOR = { x: 23, y: 5 };        // 飲料棚の上端の横から裏路地へ出る扉(研修中のシャッターが閉まっている間は壁)
const RESPAWN = [{ x: 7.5, y: 2.5 }, { x: 3.5, y: 2.5 }, { x: 12.5, y: 2.5 }];   // 捕まったあと戻される場所(店員ゾンビから遠い所)

// シフト(ステージ)は「1つ前に、要素を1つ足す」だけで作る。set の値を前のシフトに上書きしていく(personas・traits は増えていく)。
// rush=[from,to] ラッシュの時間帯(24時超えは翌日) / calm・crowd=[来店間隔(ゲーム分), 同時に店にいる客の上限] の通常時・ラッシュ時
// personas=出る客の性格 / traits=夜に出る危険な客 / news=このシフトで増えた要素(タイトルと開始時に出す)
// 店員ゾンビ(staff)は、客が多いラッシュの間だけ出勤して一緒に店を回す(客が少ない時間帯は自分ひとり)
const SHIFT_STEPS = [
  { name: '研修1日目', news: '品出し', desc: '品出しだけ。お客は少なめ。',
    set: { start: 13, hours: 3, half: true, missMax: 5, calm: [15, 3], crowd: [15, 3], personas: [], traits: [] } },
  { name: '研修2日目', news: 'ホットスナックの補充', desc: 'ホットスナックの補充が加わる。', set: { hot: true, calm: [13, 3], crowd: [13, 3] } },
  { name: '夕方シフト', news: '棚の整頓', desc: '棚が乱れる。整えて直す。',
    set: { start: 15, hours: 5, half: false, tidy: true, missMax: 7 } },
  { name: '夕方ラッシュ', news: '夕方ラッシュ(客が増える)', desc: '17〜19時はお客が一気に増える。',
    set: { rush: [17, 19], rushName: '夕方ラッシュ', crowd: [5, 7] } },
  { name: '目的買いの客', news: '客の性格「目的買い」', desc: '目的の棚だけ取って、さっさとレジへ行く客が来る。',
    set: { personas: ['direct'] } },
  { name: 'ぶらぶらの客', news: '客の性格「ぶらぶら」', desc: '棚のほかにも寄り道して、店内をゆっくり回る客が来る。',
    set: { personas: ['direct', 'roam'] } },
  { name: '期限切れの撤去', news: '期限切れ商品の撤去', desc: '棚に期限切れが混ざる。客が買う前に撤去する。', set: { expire: true } },
  { name: '雑な客', news: '客の性格「雑」', desc: '商品を雑に扱う客が来る。棚を乱して、1個落としていく。',
    set: { personas: ['direct', 'roam', 'rough'] } },
  { name: '床の清掃', news: '床の清掃(モップ)', desc: '床が汚れる。モップで拭く。', set: { spill: true } },
  { name: 'ゴミ捨て', news: 'ゴミ捨てと裏路地', desc: 'ゴミ捨ても任される。裏路地にもゾンビがいる。', set: { trash: true, alley: true } },
  { name: '納品', news: '納品', desc: '裏路地に納品の箱が届く。バックヤードの検品台まで運ぶ。', set: { deliver: true } },
  { name: '検品', news: '検品', desc: '納品の箱は検品台で伝票と照合する。数が合わない箱は返品。', set: { inspect: true } },
  { name: 'トイレ掃除', news: 'トイレ掃除', desc: '店の右下のトイレも汚れる。',
    set: { toilet: true, missMax: 8, calm: [11, 4], crowd: [4, 8] } },
  { name: '店員ゾンビと組む', news: '店員ゾンビ(ラッシュの間だけ出勤)', desc: 'ラッシュの間は店員ゾンビが出勤して一緒に回す。仕事は遅く順番もおかしいが、気づかれると襲ってくる。',
    set: { staff: true } },
  { name: '夜シフト(鼻)', news: '夜の客「鼻」', desc: '夜だけ危険なゾンビが出る。匂いで棚越しに気づく。',
    set: { start: 22, hours: 6, night: true, traits: ['smell'], rush: [24, 26], rushName: '深夜ラッシュ', calm: [14, 4] } },
  { name: '夜シフト(俊足)', news: '夜の客「俊足」', desc: '追跡がプレイヤーより速いゾンビが加わる。', set: { traits: ['smell', 'fast'] } },
  { name: '夜シフト(荒らし)', news: '夜の客「荒らし」', desc: '棚を荒らすゾンビが加わる。', set: { traits: ['smell', 'fast', 'messy'] } },
  { name: '夜シフト(猪突)', news: '夜の客「猪突」', desc: '遠くまで見えて、見つけた地点へ突進するゾンビが加わる。', set: { traits: ['smell', 'fast', 'messy', 'charge'] } },
  { name: '夜シフト(巨大)', news: '夜の客「巨大」', desc: '横幅3マスの巨大なゾンビが加わる。', set: { traits: ['smell', 'fast', 'messy', 'charge', 'giant'] } },
];
const clockStr = h => `${String(h % 24).padStart(2, '0')}:00`;
const inRush = (S, h) => !!S.rush && h >= S.rush[0] && h < S.rush[1];
const SHIFTS = (() => {
  let cur = {};
  return SHIFT_STEPS.map(st => {
    cur = Object.assign({}, cur, st.set);
    const S = Object.assign({}, cur, { name: st.name, news: st.news });
    S.desc = `${clockStr(S.start)}〜${clockStr(S.start + S.hours)}。` + st.desc;
    S.spawn = h => inRush(S, h) ? S.crowd[0] : S.calm[0];
    S.maxZ = h => inRush(S, h) ? S.crowd[1] : S.calm[1];
    return S;
  });
})();

// 夜だけ出る危険なゾンビ(trait)。smell=匂いで棚越しに気づく / fast=追跡がプレイヤーより速い / charge=視野が狭く遠くまで見え、見つけた地点へ突進 / messy=棚を乱す
const NIGHT_EVERY = [18, 32], NIGHT_MAX = 3;       // 出現間隔(秒) / 同時に出る数
const SMELL_DIST = 7, SMELL_RATE = 0.16;           // 匂いが届く距離 / 近さ1.0のときの警戒の増え(見つかるより遅い)
const FAST_CHASE = 4.3;                            // 通常の追跡は2.6。プレイヤーは3.3(荷物ありは2.0)
const CHARGE_SPEED = 3.5, CHARGE_STUN = 1.8;       // 猪突: 見つけた地点へ一直線(追跡中は狙いを更新しない)/ 空振りで止まる秒
const GIANT_SCALE = 3, GIANT_SPEED = [0.8, 1.0], GIANT_CHASE = 2.4, GIANT_CATCH = 1.6;   // 巨大: 横幅(タイル数) / 歩き / 追跡 / 捕まえる距離
const MESSY_STOCK_LOSS = 2, MESSY_SPILL = 0.5;     // 荒らされた棚で減る在庫 / 床も汚す確率
const TRAITS = {
  smell: { label: '鼻', color: '#9ad94c', skin: '#9aae5a', shirt: '#5a6a2a' },
  fast: { label: '俊足', color: '#ff5a4a', skin: '#b87060', shirt: '#b02a2a' },
  charge: { label: '猪突', color: '#e05cff', skin: '#8a6aa8', shirt: '#6a2a8a', va: 0.2, vd: 12 },
  giant: { label: '巨大', color: '#ff7a9a', skin: '#7a9a6a', shirt: '#4a4a5a' },
  messy: { label: '荒らし', color: '#ffb030', skin: '#8fae78', shirt: '#c88a20' },
};


// 普通の客の性格(夜の trait とは別。trait のない客にだけ付く)。w=出る比率 / shelves=回る棚の数 / roam=棚のほかに寄り道する場所の数 / browse=立ち止まる時間の倍率 / sp=歩く速さの倍率
const PERSONAS = {
  normal: { label: '', color: '#ccc', w: 4, shelves: [1, 3], roam: [0, 0], browse: 1, sp: 1 },
  direct: { label: '目的買い', color: '#8ad0ff', w: 3, shelves: [1, 1], roam: [0, 0], browse: 0.35, sp: 1.3 },
  roam: { label: 'ぶらぶら', color: '#ffe08a', w: 3, shelves: [2, 4], roam: [2, 4], browse: 1.3, sp: 0.8 },
  rough: { label: '雑', color: '#ffa860', w: 2, shelves: [1, 3], roam: [0, 0], browse: 1, sp: 1 },
};
const ROUGH_DROP = 0.5, ROUGH_SPILL = 0.4;   // 雑な客が棚で商品を落とす確率(在庫が1個余分に減って棚が乱れる) / 床も汚す確率

// バックヤードの在庫棚: 大きな棚4つ × 4ブロック。1ブロック = 売り場の1商品(SECTIONS の first 番から4つ)
const BACK_SHELVES = [
  { name: '食料品', x: 1, y: 1, first: 0 }, { name: 'カップ麺・菓子', x: 6, y: 1, first: 4 },
  { name: '日用品', x: 1, y: 3, first: 8 }, { name: '飲料', x: 6, y: 3, first: 12 },
];
const BACK_BLOCKS = 4;
const BACK_POS = SECTIONS.map((_, i) => { const b = BACK_SHELVES.find(b => i >= b.first && i < b.first + BACK_BLOCKS); return [b.x + i - b.first, b.y]; });
const BACK_OF = SECTIONS.map((_, i) => { const b = BACK_SHELVES.find(b => i >= b.first && i < b.first + BACK_BLOCKS); return { shelf: b.name, n: i - b.first + 1 }; });

// ---- 調整用の数値 ----
const SHUT_X = 16, OPEN_AT = 6;             // 研修中は x>=16 をシャッターで閉める / 客がこの数で全面開放
const HAND_MAX = 3;                        // 手で持てる個数(カート無し)
const CART_MAX = 12;                       // カートで持てる個数(複数の商品を混ぜてよい)
const REFILL_STEP = 0.45, REFILL_PER_HOLD = 3;   // 補充は1個ずつ / 1回の長押しで最大3個
const SPEED = { free: 3.3, crate: 2.0, bag: 2.0, mop: 3.0, other: 2.5 };   // 荷物を持つと遅くなる
const PRICE = 120, EMPTY_LIMIT = 2;         // 1個の売上 / 欠品棚がこれを超えると売上・評価が減る
const SALES_LOSS = 6, RATING_LOSS = 0.012;  // 超過1棚・1秒あたりの減り
const CLAIM_PER_EMPTY = 0.12;               // 欠品1棚ごとに、客が不満でクレームになる確率の上乗せ
const JOB_EVERY = [14, 24], JOB_MAX = 3;    // 整頓・撤去・清掃の発生間隔(秒) / 同時に残る数
const JOB_LIMIT = { tidy: 70, spill: 90, toilet: 80 };  // 放置するとクレームになるまでの秒(撤去は客が買うとクレーム)
const JOB_MSG = { tidy: '棚が乱れている', spill: '床が汚れている', toilet: 'トイレが汚れている' };
const DELIVER_EVERY = [28, 42], DELIVER_MAX = 2, DELIVER_LIMIT = 75, BAD_RATE = 0.4;   // 納品の間隔(秒) / 同時に届く数 / 放置するとクレームになる秒 / 数違いの箱の割合
const DEL_SPOTS = [[17.5, 2.5], [19.5, 2.5], [21.5, 2.5], [18.5, 1.5]];   // 裏路地で箱が置かれる場所
// 床掃除: モップ(幅3マスのローラー)で、指定された区画の汚れを塗りつぶすように拭く。区画は約30〜50マスの床
const MOP_ZONES = [
  { name: 'レジ前の通路', x0: 3, y0: 6, x1: 5, y1: 18 },
  { name: '中央の通路', x0: 9, y0: 6, x1: 11, y1: 18 },
  { name: '右の通路', x0: 14, y0: 6, x1: 16, y1: 18 },
  { name: '奥の通路', x0: 19, y0: 6, x1: 21, y1: 18 },
  { name: '売り場の上', x0: 1, y0: 6, x1: 23, y1: 8 },
  { name: '売り場の下(左)', x0: 1, y0: 16, x1: 14, y1: 18 },
  { name: '売り場の下(右)', x0: 11, y0: 16, x1: 24, y1: 18 },
];
const MOP_HOME = { x: 11, y: 0 };      // モップの定位置(バックヤードの壁)
const MOP_SHELF_LIMIT = 25;            // 棚に立てかけたまま放置すると苦情になるまでの秒
const INSPECT_TIME = 1.5, TOILET_TIME = 2.0;
// 研修ステップ(1回できたら次へ)。at は目的地の目印: 文字=タイル種 / shelf=補充先 / drop=置いた荷物
const TUT = [
  [ { ev: 'cart', at: 'C', text: 'バックヤード右下のカート置き場でカートを引き出す(1台だけ。持つと遅くなる)', key: 'E 長押し' },
    { ev: 'crate', at: 'p', text: '食料品の在庫棚の前に立って、その棚の商品をカートに積む(棚ごとに商品が決まっている)', key: 'E 長押し' },
    { ev: 'stock', at: 'shelf', text: '青く囲まれた棚の、欠けたブロックの前に立って補充(1回の長押しで最大3個)', key: 'E 長押し' },
    { ev: 'drop', at: null, text: 'カートは向いている方向の1マス先に置ける(ゾンビの壁。店長は片付けない)', key: 'Q' },
    { ev: 'pick', at: 'drop', text: '置いたカートを拾い直す', key: 'E 長押し' } ],
  [ { ev: 'frozen', at: 'F', text: '冷凍庫からホットスナックを持つ', key: 'E 長押し' },
    { ev: 'fry', at: 'R', text: 'フライヤーに入れる(揚がるまで約8秒)', key: 'E 長押し' },
    { ev: 'take', at: 'R', text: '揚がったら取り出す', key: 'E 長押し' },
    { ev: 'hot', at: 'H', text: 'ホットケースに並べる', key: 'E 長押し' } ],
];
