#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Theory Atlas — 확장용 임베딩 파이프라인 (수천 문서 → 사상의 지도)
================================================================================
폴더 안 모든 *.md(영화별 이론 개념 브리핑)에서:
  1) 개념(엔티티) 추출        — Gemini 2.5 structured output
  2) 임베딩(벡터화)           — Gemini Embedding 001 (2025 MTEB 1위) 또는 로컬 모델
  3) 2D 투영                  — UMAP (대규모) / MDS (소규모)
  4) 군집 + 라벨              — HDBSCAN 클러스터 → Gemini가 권역 이름 생성
  5) theory_atlas.json 저장 + webmap/index.html 인라인 갱신

이 한 스크립트가 "스스로 도는" 에이전트입니다. 새 .md를 넣고 다시 실행하면 지도가 커집니다.

설치 & 실행
----------
  pip install google-genai umap-learn hdbscan numpy
  export GEMINI_API_KEY="..."             # https://aistudio.google.com/apikey
  python build_theory_map.py --src ".." --out ".."

설계 메모
--------
* 임베딩 대상 = "개념명 + 이론가 + 전통 + 해설" 한 덩어리 텍스트.
  → 의미가 가까운 개념(예: Du Bois ↔ Fanon)이 벡터공간에서 가깝고, 투영 후에도 가깝게 모인다.
* 소규모(<50개)에선 UMAP이 불안정 → 자동으로 MDS로 대체.
* 군집 라벨은 LLM이 그 군집 개념들을 보고 한 줄 권역명을 짓는다(Nomic/Apple Atlas 방식).
"""
import os, re, json, glob, argparse, math
import numpy as np

# ── 1) 개념 추출 (Gemini structured output) ──────────────────────────────────
CONCEPT_SCHEMA = {
  "type":"object",
  "properties":{
    "film":{"type":"string"},"film_dir":{"type":"string"},"film_year":{"type":"integer"},
    "concepts":{"type":"array","items":{"type":"object","properties":{
      "concept":{"type":"string"}, "theorist":{"type":"string"}, "year":{"type":"integer"},
      "work":{"type":"string"}, "tradition":{"type":"string"},
      "en":{"type":"string","description":"개념 해설 영어 1문단"},
      "ko":{"type":"string","description":"개념 해설 한국어 1문단"}
    },"required":["concept","theorist","tradition","en","ko"]}}
  },"required":["film","concepts"]
}
EXTRACT_PROMPT = """Extract every THEORY/CONCEPT entity from this film-theory briefing.
For each: the concept name, the theorist, the source work and year, the intellectual
tradition (use the header's listed traditions), and the explanatory paragraph in both
English (en) and Korean (ko), copied/condensed from the document. JSON only.

DOCUMENT:
---
{md}
---"""

def extract(md, model="gemini-2.5-flash"):
    from google import genai; from google.genai import types
    cl = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    r = cl.models.generate_content(model=model, contents=EXTRACT_PROMPT.format(md=md[:14000]),
        config=types.GenerateContentConfig(response_mime_type="application/json",
            response_schema=CONCEPT_SCHEMA, temperature=0.1))
    return json.loads(r.text)

# ── 2) 임베딩 (Gemini Embedding 001) ─────────────────────────────────────────
def embed(texts, model="gemini-embedding-001"):
    from google import genai; from google.genai import types
    cl = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    vecs = []
    for t in texts:  # 배치로 묶어도 됨; 명료성 위해 단건
        e = cl.models.embed_content(model=model, contents=t,
            config=types.EmbedContentConfig(task_type="SEMANTIC_SIMILARITY"))
        vecs.append(e.embeddings[0].values)
    return np.array(vecs, dtype=float)

# ── 3) 2D 투영 ───────────────────────────────────────────────────────────────
def project(V):
    n = len(V)
    if n >= 50:
        import umap
        return umap.UMAP(n_neighbors=min(15,n-1), min_dist=0.1, metric="cosine",
                         random_state=42).fit_transform(V)
    # 소규모: 코사인거리 → SMACOF MDS (numpy)
    Vn = V/ (np.linalg.norm(V,axis=1,keepdims=True)+1e-9)
    D = 1 - Vn@Vn.T; np.fill_diagonal(D,0)
    J = np.eye(n)-np.ones((n,n))/n; B=-0.5*J@(D**2)@J
    w,vec=np.linalg.eigh(B); o=np.argsort(w)[::-1]
    X=vec[:,o[:2]]*np.sqrt(np.maximum(w[o[:2]],0))
    for _ in range(400):
        d=np.linalg.norm(X[:,None]-X[None],axis=2); d[d==0]=1e-9
        Bm=-D/d; np.fill_diagonal(Bm,0); np.fill_diagonal(Bm,-Bm.sum(1)); X=(Bm@X)/n
    return X

# ── 4) 군집 + LLM 라벨 ───────────────────────────────────────────────────────
def cluster(V):
    n=len(V)
    try:
        import hdbscan
        lab=hdbscan.HDBSCAN(min_cluster_size=max(3,n//12),metric="euclidean").fit_predict(
            V/ (np.linalg.norm(V,axis=1,keepdims=True)+1e-9))
        if len(set(lab))>1: return lab
    except Exception: pass
    # 폴백: k-means(numpy)
    k=max(2,min(6,n//3)); rng=np.random.default_rng(0)
    C=V[rng.choice(n,k,replace=False)]
    for _ in range(50):
        a=np.argmin(((V[:,None]-C[None])**2).sum(2),axis=1)
        C=np.array([V[a==j].mean(0) if (a==j).any() else C[j] for j in range(k)])
    return a

def label_cluster(concepts, model="gemini-2.5-flash"):
    from google import genai
    cl=genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    names=", ".join(c["concept"]+" ("+c["theorist"]+")" for c in concepts)
    p=f"이 이론 개념들이 공유하는 '사상 권역' 이름을 한국어·영어 한 줄로(예: '시선과 권력 · The Look & Power'). 개념들: {names}"
    return cl.models.generate_content(model=model, contents=p).text.strip().split("\n")[0]

# ── 메인 ─────────────────────────────────────────────────────────────────────
PALETTE=["#e85d75","#5bc0be","#f4a259","#9b5de5","#4895ef","#80b918","#ff7b00","#00b4d8"]

def hull(P):  # convex hull (monotone chain)
    P=sorted(set(map(tuple,P)))
    if len(P)<=2: return P
    cr=lambda o,a,b:(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lo=[];
    for p in P:
        while len(lo)>=2 and cr(lo[-2],lo[-1],p)<=0: lo.pop()
        lo.append(p)
    up=[]
    for p in reversed(P):
        while len(up)>=2 and cr(up[-2],up[-1],p)<=0: up.pop()
        up.append(p)
    return lo[:-1]+up[:-1]

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--src",default=".."); ap.add_argument("--out",default="..")
    a=ap.parse_args()
    files=[f for f in sorted(glob.glob(os.path.join(a.src,"*.md"))) if "README" not in f]
    print(f".md {len(files)}개 발견")
    items=[]
    for f in files:
        md=open(f,encoding="utf-8").read()
        try: ext=extract(md)
        except Exception as e: print("  추출 실패",f,e); continue
        for c in ext["concepts"]:
            c["film"]=ext.get("film",""); c["film_dir"]=ext.get("film_dir","")
            c["film_year"]=ext.get("film_year"); c["id"]=re.sub(r"[^a-z0-9]+","",c["concept"].lower())[:20]
            items.append(c)
    print(f"개념 {len(items)}개 → 임베딩")
    V=embed([f"{c['concept']} — {c['theorist']} ({c['tradition']}). {c['en']}" for c in items])
    XY=project(V); lab=cluster(V)
    XY=(XY-XY.mean(0))/(np.abs(XY).max()+1e-9)*100

    # 군집 → 권역
    regions=[]; reg_color={}
    for ci,cl_id in enumerate(sorted(set(lab))):
        members=[i for i in range(len(items)) if lab[i]==cl_id]
        color=PALETTE[ci%len(PALETTE)]
        try: name=label_cluster([items[i] for i in members])
        except Exception: name=f"Region {ci+1}"
        pts=[[float(XY[i,0]),float(XY[i,1])] for i in members]
        cx=sum(p[0] for p in pts)/len(pts); cy=sum(p[1] for p in pts)/len(pts)
        poly=hull(pts) if len(pts)>=3 else [[cx+22*math.cos(t),cy+22*math.sin(t)] for t in np.linspace(0,2*math.pi,24)]
        regions.append(dict(key=f"r{ci}",label=name,color=color,centroid=[cx,cy],
                            polygon=[[float(x),float(y)] for x,y in poly]))
        for i in members: reg_color[i]=(f"r{ci}",color)

    nodes=[]
    for i,c in enumerate(items):
        rk,col=reg_color[i]
        nodes.append({**c,"x":float(XY[i,0]),"y":float(XY[i,1]),"region":rk,"color":col})
    # 의미 이웃 엣지(코사인 상위)
    Vn=V/(np.linalg.norm(V,axis=1,keepdims=True)+1e-9); Sm=Vn@Vn.T
    edges=[{"s":items[i]["id"],"t":items[j]["id"],"w":float(Sm[i,j])}
           for i in range(len(items)) for j in range(i+1,len(items)) if Sm[i,j]>=0.62]
    atlas=dict(nodes=nodes,regions=regions,edges=edges,
               meta=dict(count=len(nodes),method="Gemini embedding → UMAP/MDS → HDBSCAN",docs=len(files)))
    os.makedirs(os.path.join(a.out,"data"),exist_ok=True)
    json.dump(atlas,open(os.path.join(a.out,"data","theory_atlas.json"),"w",encoding="utf-8"),ensure_ascii=False,indent=2)

    idx=os.path.join(a.out,"webmap","index.html")
    if os.path.exists(idx):
        h=open(idx,encoding="utf-8").read()
        h=re.sub(r"const ATLAS = .*?;\nlet lang",
                 "const ATLAS = "+json.dumps(atlas,ensure_ascii=False)+";\nlet lang",h,flags=re.S)
        open(idx,"w",encoding="utf-8").write(h)
        print("  webmap/index.html 갱신")
    print(f"완료: 개념 {len(nodes)} · 권역 {len(regions)} · 엣지 {len(edges)}")

if __name__=="__main__":
    main()
