// 本のデータ置き場(手書き部分)。isbn がある本は fetch_books.py が出版社・価格・紹介文・表紙を fetched.js に取得する。
// title / coverText / author / 色は、取得できなかったときの代わり(canvasの表紙)にも使う。
// center: true の本がひな壇の中央に置かれる。
const BOOKS = [
  { isbn:'9784101001012', title:'雪国', coverText:'雪国', author:'川端 康成', bg:'#e8eef2', fg:'#1d2b3a', style:0 },
  { isbn:'9784101006055', title:'人間失格', coverText:'人間\n失格', author:'太宰 治', bg:'#2a2540', fg:'#ffd98a', style:0 },
  { isbn:'9784101010014', title:'吾輩は猫である', coverText:'吾輩は\n猫である', author:'夏目 漱石', bg:'#e8c9a0', fg:'#3a2a20', style:1 },
  { isbn:'9784101025018', title:'羅生門・鼻', coverText:'羅生門\n・鼻', author:'芥川 竜之介', bg:'#c9473a', fg:'#fff1e0', style:1 },
  { isbn:'9784062749985', title:'流星ワゴン', coverText:'流星\nワゴン', author:'重松 清', bg:'#7fa3b8', fg:'#10222c', style:0 },
  { isbn:'9784101001029', title:'伊豆の踊子', coverText:'伊豆の\n踊子', author:'川端 康成', bg:'#b8d4c2', fg:'#25402f', style:2 },
  { isbn:'9784101006017', title:'晩年', coverText:'晩年', author:'太宰 治', bg:'#d9d3c7', fg:'#2b2b2b', style:1 },
  { center:true, title:'#100日チャレンジ 毎日連続100本アプリを作ったら人生が変わった', coverText:'100日\nチャレンジ', author:'大塚 あみ', isbn:'9784296071067', publisher:'日経BP', year:2025, price:null, pages:null,
    bg:'#111418', fg:'#7CFC9A', style:1, summary:'日記だと思って読んでみ？プログラミングできるようになるから' },
];
