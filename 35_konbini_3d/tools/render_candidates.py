"""tools/candidates.json から candidates.html を作る。クリックで選択、下のテキスト欄に溜まる(localStorage に保存)。
使い方: uv run --no-project tools/render_candidates.py   (35/ で実行)"""
import json, html
d = json.load(open('tools/candidates.json'))
h = ['''<!DOCTYPE html><meta charset=utf-8><title>3D候補</title><style>
body{font:13px sans-serif;background:#eee;margin:16px 16px 260px}.g{display:flex;flex-wrap:wrap;gap:8px}
.c{background:#fff;width:170px;padding:6px;border-radius:6px;cursor:pointer;border:3px solid transparent;position:relative}
.c.on{border-color:#2a8;background:#e6fff3}.c img{width:100%;height:120px;object-fit:contain;background:#ddd}
.c a{position:absolute;right:6px;top:6px;background:#fffc;padding:0 4px;border-radius:3px;font-size:11px}
h2{margin:18px 0 6px}small{color:#666}
#ed{position:fixed;left:0;right:0;bottom:0;height:230px;background:#222;color:#fff;padding:8px 16px;box-sizing:border-box}
#ed textarea{width:100%;height:150px;font:12px monospace;box-sizing:border-box}#ed button{margin-right:6px}
</style><h1>Polyfork 候補(CC BY 4.0。クレジット表記が要る)</h1>
<p>カードをクリックで選択/解除(緑)。右上の「開く」で元ページ。選んだものは下のメモ欄に溜まります。</p>''']
for jp, items in d.items():
    h.append(f'<h2>{html.escape(jp)}</h2><div class=g>' + ('' if items else '<small>該当なし</small>'))
    for it in items:
        sz = it.get('size', {})
        line = f'{jp}: {it["id"]} ({it["title"]}) {it["url"]}'
        h.append(f'<div class=c data-line="{html.escape(line, quote=True)}"><a href="{it["url"]}" target=_blank onclick="event.stopPropagation()">開く</a>'
                 f'<img src="{it["thumbnailUrl"]}" loading=lazy><b>{html.escape(it["title"])}</b><br>'
                 f'<small>{it["id"]}<br>{it["triangles"]}三角形 / {sz.get("x")}×{sz.get("y")}×{sz.get("z")}</small></div>')
    h.append('</div>')
h.append('''<div id=ed><button id=cp>全部コピー</button><button id=cl>クリア</button> <span id=n></span>
<textarea id=ta placeholder="選んだものがここに溜まる。自由に編集してメモも書ける"></textarea></div>
<script>
const KEY='day35_picks',ta=document.getElementById('ta');
const safe=f=>{try{return f()}catch(e){}};
ta.value=safe(()=>localStorage.getItem(KEY))||'';
const save=()=>{safe(()=>localStorage.setItem(KEY,ta.value));sync()};
function lines(){return ta.value.split('\\n')}
function sync(){const L=lines();document.querySelectorAll('.c').forEach(c=>c.classList.toggle('on',L.includes(c.dataset.line)));
  document.getElementById('n').textContent=L.filter(x=>x.trim()).length+'件'}
document.querySelectorAll('.c').forEach(c=>c.onclick=()=>{
  const L=lines().filter(x=>x.trim()),i=L.indexOf(c.dataset.line);
  if(i>=0)L.splice(i,1);else L.push(c.dataset.line);
  ta.value=L.join('\\n');save()});
ta.oninput=save;
document.getElementById('cp').onclick=()=>{ta.select();safe(()=>navigator.clipboard.writeText(ta.value))};
document.getElementById('cl').onclick=()=>{ta.value='';save()};
sync();
</script>''')
open('candidates.html', 'w').write('\n'.join(h))
print('ok')
