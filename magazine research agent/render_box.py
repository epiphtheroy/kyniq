"""
render_box.py
─────────────
*_enriched.csv (comment_extractor.py 산출물)를 입력으로,
"주요 매체 코멘트" 박스를 독립 실행형 HTML 파일로 렌더링한다.

표시 규칙(최종 합의):
  - 코멘트가 핵심 → 각 칸 '상단'에 코멘트(verdict 축어, 없으면 제목), '아래'에 원제목.
  - verdict tier 는 앞에 인용부호 마커(파란색)로 표시.
  - 그룹: 비평(criticism)=Reviews, 학술(academic)=Academic. 그룹 내 verdict 먼저.
  - 한국어 등 특정 언어는 --exclude-lang 으로 박스에서 제외 가능(데이터는 보존).
  - 모든 칸에 출처(매체·필자·연도) + 원문 링크.

사용:
  python render_box.py barbara_comments_enriched.csv barbara_box.html \
        --title "Barbara — Christian Petzold, 2012" --exclude-lang ko
"""
from __future__ import annotations
import csv, sys, html, argparse

def esc(s: str) -> str:
    return html.escape(s or "", quote=True)

LANG_PILL = {"en":"EN","de":"DE","fr":"FR","nl":"NL","no":"NO","da":"DA","it":"IT",
             "es":"ES","pt":"PT","ru":"RU","ko":"KO","ja":"JA","zh":"ZH","sv":"SV",
             "pl":"PL","cs":"CS","hu":"HU","tr":"TR"}

ROW = """    <div class="row" data-cat="{cat}" data-tier="{tier}">
      <div class="pill">{pill}</div>
      <div class="body">
        <div class="cmt">{marker}{comment}</div>
        {title_line}
        <div class="src">{src}</div>
      </div>
      <a class="lnk" href="{url}" target="_blank" rel="noopener" aria-label="open source">&#8599;</a>
    </div>"""

def render(rows, header_title):
    crit = [r for r in rows if r["type"] == "criticism"]
    acad = [r for r in rows if r["type"] == "academic"]
    order = {"verdict": 0, "title-eval": 1, "title": 2}
    keyf = lambda r: order.get(r["tier"], 3)
    crit.sort(key=keyf); acad.sort(key=keyf)

    def row_html(r):
        tier = r["tier"]; comment = r["comment"].strip(); title = r["title"].strip()
        marker = '<span class="q">&#8220;</span>' if tier == "verdict" else ""
        # verdict/title-eval 은 따옴표로 감싸 코멘트임을 표시
        comment_disp = f'&#8220;{esc(comment)}&#8221;' if tier in ("verdict","title-eval") else esc(comment)
        if tier == "verdict":
            comment_disp = f'<span class="q">&#8220;</span>{esc(comment)}&#8221;'
        title_line = ""
        if title and title != comment:
            title_line = f'<div class="ttl">{esc(title)}</div>'
        src_bits = [b for b in [r["outlet"], r["critic"], r["year"]] if b and b != "unknown"]
        return ROW.format(cat="crit" if r["type"]=="criticism" else "acad",
                          tier=tier, pill=LANG_PILL.get(r["language"], (r["language"] or "·").upper()[:2]),
                          marker="", comment=comment_disp, title_line=title_line,
                          src=esc(" · ".join(src_bits)), url=esc(r["url"]))

    n_all=len(rows); n_cmt=sum(1 for r in rows if r["tier"] in ("verdict","title-eval"))
    crit_html = "\n".join(row_html(r) for r in crit)
    acad_html = "\n".join(row_html(r) for r in acad)
    return PAGE.format(htitle=esc(header_title), n_all=n_all, n_cmt=n_cmt,
                       n_crit=len(crit), n_acad=len(acad),
                       crit_rows=crit_html, acad_rows=acad_html)

PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{htitle}</title>
<style>
:root{{--bg:#fff;--bd:#e7e5df;--fg:#1f1f1d;--mut:#6b6a64;--ter:#9a988f;--info:#185fa5;--infobg:#e6f1fb}}
*{{box-sizing:border-box}} body{{margin:0;background:#f5f4ef;color:var(--fg);
 font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}}
.box{{max-width:720px;margin:24px auto;background:var(--bg);border:1px solid var(--bd);border-radius:12px;padding:18px 20px}}
.h1{{font-size:20px;font-weight:600}} .meta{{font-size:14px;color:var(--mut);margin-left:8px}}
.bar{{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:10px 0 2px}}
.cap{{font-size:15px;font-weight:600}} .cnt{{color:var(--mut);font-weight:400}}
.fbs{{display:flex;gap:6px;flex-wrap:wrap}}
.fb{{font-size:13px;padding:4px 11px;border-radius:8px;border:1px solid var(--bd);background:transparent;cursor:pointer;color:var(--fg)}}
.fb.on{{border-color:var(--info);background:var(--infobg);color:var(--info)}}
.legend{{font-size:12px;color:var(--ter);margin-bottom:2px}}
.hdr{{font-size:12px;color:var(--ter);font-weight:600;margin:14px 0 2px}}
.row{{display:flex;gap:11px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--bd)}}
.pill{{flex:none;min-width:26px;text-align:center;font-size:11px;font-weight:600;color:var(--mut);background:#f1efe8;border-radius:8px;padding:2px 5px;margin-top:2px}}
.body{{flex:1}} .cmt{{font-size:15px;line-height:1.45}} .q{{color:var(--info)}}
.ttl{{font-size:13px;color:var(--mut);margin-top:3px}} .src{{font-size:12.5px;color:var(--ter);margin-top:2px}}
.lnk{{flex:none;color:var(--mut);text-decoration:none;font-size:18px;margin-top:2px}} .lnk:hover{{color:var(--info)}}
.foot{{font-size:12px;color:var(--ter);border-top:1px solid var(--bd);margin-top:12px;padding-top:8px}}
</style></head><body>
<div class="box">
  <div><span class="h1">{htitle}</span></div>
  <div class="bar">
    <div class="cap">Critic &amp; academic comments <span class="cnt">{n_all}</span></div>
    <div class="fbs">
      <button class="fb on" data-f="all">All {n_all}</button>
      <button class="fb" data-f="eval">Comment {n_cmt}</button>
      <button class="fb" data-f="crit">Reviews {n_crit}</button>
      <button class="fb" data-f="acad">Papers {n_acad}</button>
    </div>
  </div>
  <div class="legend">&#8220; marker = ≤10-word verbatim line from the outlet's blurb or the paper's abstract · title sits beneath</div>
  <div id="g-crit"><div class="hdr">Reviews ({n_crit})</div>
{crit_rows}
  </div>
  <div id="g-acad"><div class="hdr">Academic ({n_acad})</div>
{acad_rows}
  </div>
  <div class="foot">Titles and ≤10-word quotes from public metadata (titles, blurbs, abstracts) only · click for source</div>
</div>
<script>
(function(){{
  var btns=document.querySelectorAll('.fb'),rows=document.querySelectorAll('.row');
  var gc=document.getElementById('g-crit'),ga=document.getElementById('g-acad');
  function vis(r,f){{var c=r.getAttribute('data-cat'),t=r.getAttribute('data-tier');
    if(f==='all')return true; if(f==='eval')return t==='verdict'||t==='title-eval';
    if(f==='crit')return c==='crit'; if(f==='acad')return c==='acad'; return true;}}
  btns.forEach(function(b){{b.addEventListener('click',function(){{
    btns.forEach(function(x){{x.classList.remove('on')}}); b.classList.add('on');
    var f=b.getAttribute('data-f');
    rows.forEach(function(r){{r.style.display=vis(r,f)?'flex':'none'}});
    gc.style.display=(f==='acad')?'none':'block'; ga.style.display=(f==='crit')?'none':'block';
  }})}});
}})();
</script></body></html>"""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("in_csv")
    ap.add_argument("out_html")
    ap.add_argument("--title", default="Barbara — Christian Petzold, 2012")
    ap.add_argument("--exclude-lang", default="", help="쉼표구분 언어코드(예: ko,ja) → 박스에서 제외")
    a = ap.parse_args()
    excl = {x.strip() for x in a.exclude_lang.split(",") if x.strip()}
    rows = [r for r in csv.DictReader(open(a.in_csv, encoding="utf-8")) if r["language"] not in excl]
    open(a.out_html, "w", encoding="utf-8").write(render(rows, a.title))
    print(f"wrote {len(rows)} rows → {a.out_html}  (excluded langs: {sorted(excl) or 'none'})")

if __name__ == "__main__":
    main()
