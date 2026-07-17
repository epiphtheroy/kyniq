/**
 * GET /api/v1/embed.js — the TakeScore badge loader (Rotten-Tomatoes style).
 *
 * A site adds ONE anchor + this script:
 *   <a class="metatake-takescore" data-film="mulholland-drive-2001"
 *      href="https://metatake.net/film/mulholland-drive-2001">Metatake TakeScore</a>
 *   <script async src="https://metatake.net/api/v1/embed.js"></script>
 *
 * The anchor already sits in the host page's static HTML → a real do-follow
 * backlink that search engines see even with JS off. The script just enhances it
 * into a styled score pill (fetched live from /api/v1/takescore/{slug}). This is
 * the "give freely, attribution structural" philosophy as a web widget.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JS = `(function(){
  var me = document.currentScript;
  var BASE = (function(){ try { return new URL(me.src).origin; } catch(e){ return "https://metatake.net"; } })();
  var STYLE_ID = "metatake-badge-style";
  if(!document.getElementById(STYLE_ID)){
    var s=document.createElement("style"); s.id=STYLE_ID; s.textContent=
      ".mtk-badge{display:inline-flex;align-items:center;gap:.5em;text-decoration:none;font:600 13px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"
      +"color:#1c2029;background:#fff;border:1px solid rgba(0,0,0,.14);border-radius:999px;padding:.42em .7em;box-shadow:0 1px 2px rgba(0,0,0,.08);vertical-align:middle}"
      +".mtk-badge:hover{border-color:rgba(0,0,0,.3)}"
      +".mtk-badge__n{font-weight:800;font-size:15px;color:#0f766e}"
      +".mtk-badge__lab{color:#3a3f4a}.mtk-badge__wm{color:#b91c1c;font-weight:800;letter-spacing:.02em}"
      +".mtk-badge__x{color:#8a8f99;font-size:11px;font-weight:600}"
      +"@media (prefers-color-scheme:dark){.mtk-badge{color:#e8eaed;background:#16181d;border-color:rgba(255,255,255,.16)}.mtk-badge__lab{color:#c4c8d0}.mtk-badge__n{color:#2dd4bf}}";
    document.head.appendChild(s);
  }
  function slugOf(a){
    var d=a.getAttribute("data-film"); if(d) return d.trim();
    var h=a.getAttribute("href")||""; var m=h.match(/\\/film\\/([^\\/?#]+)/); return m?m[1]:null;
  }
  function render(a){
    if(a.getAttribute("data-mtk-done")) return; a.setAttribute("data-mtk-done","1");
    var slug=slugOf(a); if(!slug) return;
    if(!a.getAttribute("href")) a.setAttribute("href", BASE+"/film/"+slug);
    a.setAttribute("rel","noopener"); a.setAttribute("target","_blank");
    a.className=(a.className?a.className+" ":"")+"mtk-badge";
    a.title="TakeScore on Metatake — AI-computed, human-directed film criticism";
    fetch(BASE+"/api/v1/takescore/"+encodeURIComponent(slug)).then(function(r){return r.ok?r.json():null;}).then(function(d){
      var n=(d&&typeof d.score==="number")?Math.max(0,Math.round(d.score)):null;
      a.innerHTML='<span class="mtk-badge__n">'+(n!=null?n:"–")+'</span>'
        +'<span class="mtk-badge__lab">TakeScore</span>'
        +'<span class="mtk-badge__x">on</span><span class="mtk-badge__wm">Metatake</span>';
    }).catch(function(){
      a.innerHTML='<span class="mtk-badge__lab">TakeScore on</span><span class="mtk-badge__wm">Metatake</span>';
    });
  }
  function scan(){ var els=document.querySelectorAll("a.metatake-takescore,a[data-film]"); for(var i=0;i<els.length;i++) render(els[i]); }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",scan); else scan();
})();`;

export function GET() {
  return new NextResponse(JS, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
      "x-robots-tag": "noindex",
    },
  });
}
