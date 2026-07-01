# -*- coding: utf-8 -*-
"""대규모(약 1000노드) theory_atlas.json → deck.gl 지도 (dense 모드). 데이터 인라인."""
import json, os
OUT = os.environ["OUT_DIR"]
atlas = json.load(open(os.path.join(OUT,"data","theory_atlas.json"), encoding="utf-8"))

HTML = r"""<!DOCTYPE html><html lang="ko"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Theory Atlas · 1000 — 사상의 지도</title>
<script src="https://unpkg.com/deck.gl@9.0.38/dist.min.js"></script>
<style>
:root{--bg:#0a0d13;--panel:#10151e;--line:#212a37;--txt:#e6edf3;--mut:#8e9bab;--accent:#ffd166}
*{box-sizing:border-box}html,body{margin:0;height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Noto Sans KR",sans-serif;background:var(--bg);color:var(--txt);overflow:hidden}
#app{display:flex;height:100vh}#stage{flex:1;position:relative}#deck-canvas{width:100%;height:100%}
#side{width:370px;max-width:44vw;background:var(--panel);border-left:1px solid var(--line);display:flex;flex-direction:column}
header{padding:13px 16px;border-bottom:1px solid var(--line)}header h1{font-size:14px;margin:0 0 3px}
header p{margin:0;font-size:11px;color:var(--mut);line-height:1.5}
#search{margin:10px 14px 6px;padding:8px 11px;background:#0a0d13;border:1px solid var(--line);border-radius:8px;color:var(--txt);font-size:12px;width:calc(100% - 28px)}
.row{display:flex;gap:5px;flex-wrap:wrap;padding:6px 14px 10px;border-bottom:1px solid var(--line)}
.chip{font-size:10.5px;padding:3px 8px;border:1px solid var(--line);border-radius:999px;cursor:pointer;user-select:none;display:flex;align-items:center;gap:4px;color:#0a0d13;font-weight:600}
.chip.off{background:none!important;color:var(--mut);font-weight:400}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:0 0 auto}
#count{padding:7px 16px;font-size:11px;color:var(--mut);border-bottom:1px solid var(--line)}
#list{flex:1;overflow-y:auto}
.card{padding:10px 16px;border-bottom:1px solid var(--line);cursor:pointer}.card:hover{background:#161f2c}
.card .ttl{font-size:12.5px;font-weight:600;margin-bottom:2px}.card .meta{font-size:10.5px;color:var(--mut);margin-bottom:4px}
.card .ex{font-size:11.5px;color:#c4cdd6;line-height:1.45}
#hint{position:absolute;left:12px;bottom:12px;background:rgba(16,21,30,.9);border:1px solid var(--line);border-radius:9px;padding:7px 11px;font-size:11px;color:var(--mut)}
#tooltip{position:absolute;pointer-events:none;z-index:30;background:#0a0d13;border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-size:12px;max-width:260px;display:none}#tooltip b{color:var(--accent)}
#reader{position:fixed;top:0;right:-580px;width:560px;max-width:94vw;height:100%;background:var(--panel);border-left:1px solid var(--line);box-shadow:-20px 0 50px rgba(0,0,0,.55);transition:right .28s;z-index:60;overflow-y:auto}
#reader.open{right:0}.rhead{padding:22px 24px 14px;border-bottom:1px solid var(--line)}
.rhead .tag{font-size:11px;text-transform:uppercase;letter-spacing:.6px;font-weight:700}
.rhead h2{margin:6px 0 2px;font-size:22px}.rhead .nat{color:var(--mut);font-size:13px;font-style:italic}
.close{position:absolute;top:16px;right:16px;border:1px solid var(--line);background:none;color:var(--txt);width:30px;height:30px;border-radius:8px;cursor:pointer}
.rbody{padding:18px 24px}.rbody h4{margin:0 0 6px;font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:.5px}
.rbody p{font-size:14.5px;line-height:1.7;color:#d7dee6;margin:0 0 18px}
.kv{font-size:12.5px;color:#aab4be;line-height:1.9}.kv b{color:var(--txt)}
</style></head><body>
<div id="app">
  <div id="stage"><div id="deck-canvas"></div><div id="tooltip"></div>
    <div id="hint">🖱️ 드래그=이동 · 휠=확대/축소 · 점 클릭=개념 열람 · 색=학문 도메인</div></div>
  <aside id="side">
    <header><h1>🧭 Theory Atlas · 999 Concepts</h1>
      <p>실제 이론 DB에서 뽑은 <b id="nn"></b>개 개념의 의미 지도. 가까울수록 뜻이 가깝습니다(TF-IDF→LSA→MDS).</p></header>
    <input id="search" placeholder="개념·이론가 검색…" oninput="refreshList()"/>
    <div class="row" id="filters"></div>
    <div id="count"></div><div id="list"></div>
  </aside>
</div>
<div id="reader"><button class="close" onclick="closeReader()">✕</button><div id="rc"></div></div>
<script>
const ATLAS=__ATLAS__; const NODE={}; ATLAS.nodes.forEach(n=>NODE[n.id]=n);
document.getElementById("nn").textContent=ATLAS.nodes.length;
let active=new Set(ATLAS.regions.map(r=>r.key));
const hex2rgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const fr=document.getElementById("filters");
ATLAS.regions.sort((a,b)=>b.n-a.n).forEach(r=>{
  const c=document.createElement("div");c.className="chip";c.style.background=r.color;
  c.innerHTML=`<span class="dot" style="background:#0a0d13"></span>${r.label} ${r.n}`;
  c.onclick=()=>{const off=c.classList.toggle("off");off?active.delete(r.key):active.add(r.key);render();};
  fr.appendChild(c);
});
const {Deck,OrthographicView,ScatterplotLayer,TextLayer,LineLayer,COORDINATE_SYSTEM}=deck;
const CART=COORDINATE_SYSTEM.CARTESIAN; let deckgl,viewport=null;
function layers(){
  const ns=ATLAS.nodes.filter(n=>active.has(n.region));
  return [
    new LineLayer({id:"edges",coordinateSystem:CART,
      data:ATLAS.edges.filter(e=>active.has(NODE[e.s].region)&&active.has(NODE[e.t].region)),
      getSourcePosition:e=>[NODE[e.s].x,NODE[e.s].y],getTargetPosition:e=>[NODE[e.t].x,NODE[e.t].y],
      getColor:[120,140,160,28],getWidth:0.6,widthUnits:"pixels"}),
    new ScatterplotLayer({id:"nodes",coordinateSystem:CART,data:ns,
      getPosition:n=>[n.x,n.y],getFillColor:n=>hex2rgb(n.color),getRadius:3.4,radiusUnits:"pixels",
      stroked:true,getLineColor:[10,13,19],getLineWidth:0.6,lineWidthUnits:"pixels",
      pickable:true,onClick:i=>i.object&&openReader(i.object.id),onHover:showTip,
      updateTriggers:{getFillColor:[...active]}}),
    new TextLayer({id:"rlabels",coordinateSystem:CART,
      data:ATLAS.regions.filter(r=>active.has(r.key)),
      getPosition:r=>r.centroid,getText:r=>r.label,getColor:r=>[...hex2rgb(r.color),200],
      getSize:16,characterSet:"auto",fontWeight:800,billboard:true,
      getPixelOffset:[0,0],outlineWidth:2,outlineColor:[10,13,19,255]}),
  ];
}
function render(){if(deckgl)deckgl.setProps({layers:layers()});refreshList();}
deckgl=new Deck({parent:document.getElementById("deck-canvas"),views:new OrthographicView({}),
  initialViewState:{target:[0,0,0],zoom:1.6,minZoom:0.3,maxZoom:7},controller:true,layers:layers(),
  onViewStateChange:()=>{viewport=deckgl.getViewports()[0];refreshList();},
  onLoad:()=>{viewport=deckgl.getViewports()[0];refreshList();}});
function showTip(info){const t=document.getElementById("tooltip");
  if(info.object){const n=info.object;t.style.display="block";t.style.left=(info.x+14)+"px";t.style.top=(info.y+14)+"px";
    t.innerHTML=`<b>${n.concept}</b><br>${n.theorist||""}<br><span style="color:#8e9bab">${n.film_dir} · ${n.tradition}</span>`;}
  else t.style.display="none";}
function inView(n){if(!viewport)return true;const tl=viewport.unproject([0,0]),br=viewport.unproject([viewport.width,viewport.height]);
  return n.x>=Math.min(tl[0],br[0])&&n.x<=Math.max(tl[0],br[0])&&n.y>=Math.min(tl[1],br[1])&&n.y<=Math.max(tl[1],br[1]);}
function refreshList(){
  const q=(document.getElementById("search").value||"").toLowerCase().trim();
  let ns=ATLAS.nodes.filter(n=>active.has(n.region));
  if(q) ns=ns.filter(n=>(n.concept+" "+n.theorist+" "+n.en).toLowerCase().includes(q));
  else ns=ns.filter(inView);
  document.getElementById("count").textContent=
    (q?`검색 "${q}": ${ns.length}건`:`화면 안 ${ns.length}개`)+` · 전체 ${ATLAS.nodes.length}`;
  ns=ns.slice(0,160);
  document.getElementById("list").innerHTML=ns.map(n=>`
    <div class="card" onclick="flyTo('${n.id}')">
      <div class="ttl"><span class="dot" style="background:${n.color}"></span> ${n.concept}</div>
      <div class="meta">${n.theorist||"—"} · ${n.film_dir}</div>
      <div class="ex">${n.en||""}</div></div>`).join("")
    || `<div style="padding:20px;color:var(--mut);font-size:12px">결과 없음.</div>`;
}
function flyTo(id){const n=NODE[id];deckgl.setProps({initialViewState:{target:[n.x,n.y,0],zoom:4.2,transitionDuration:550}});openReader(id);}
function openReader(id){const n=NODE[id];
  document.getElementById("rc").innerHTML=`
   <div class="rhead"><div class="tag" style="color:${n.color}">${n.film_dir} · ${n.film}</div>
     <h2>${n.concept}</h2>${n.work?`<div class="nat">${n.work}</div>`:""}</div>
   <div class="rbody">
     <h4>개념</h4><p>${n.en||""}</p>
     <div class="kv"><b>이론가</b> · ${n.theorist||"—"}<br><b>도메인</b> · ${n.film_dir}<br>
       <b>분류</b> · ${n.film} › ${n.tradition}</div></div>`;
  document.getElementById("reader").classList.add("open");}
function closeReader(){document.getElementById("reader").classList.remove("open");}
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeReader();});
</script></body></html>"""
HTML = HTML.replace("__ATLAS__", json.dumps(atlas, ensure_ascii=False))
os.makedirs(os.path.join(OUT,"webmap"), exist_ok=True)
open(os.path.join(OUT,"webmap","index.html"),"w",encoding="utf-8").write(HTML)
print("wrote webmap/index.html", len(HTML), "bytes |", len(atlas["nodes"]), "nodes")
