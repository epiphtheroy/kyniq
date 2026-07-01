# -*- coding: utf-8 -*-
"""
Theory Atlas @ scale — 실제 1000개 개념으로 의미 지도 생성 (순수 numpy)
====================================================================
입력 : Theory_Concepts_canonical.csv  (concept, native, one_liner, part, major, sub, theorists)
방법 : 텍스트 → TF-IDF → LSA(잠재의미분석, SVD) → 코사인거리 → 고전MDS+SMACOF → 2D
       군집(영역)=도메인(part). kNN purity로 '임베딩이 의미를 잡았는지' 정량 진단.
출력 : data/theory_atlas.json  (대규모 동일 스키마)
"""
import os, csv, re, json, math, random, time
import numpy as np

SRC = os.environ["SRC_CSV"]
OUT = os.environ.get("OUT_DIR", ".")
N_TARGET = int(os.environ.get("N", "1000"))
random.seed(42); np.random.seed(42)

# ── 1) 로드 & 층화표본 ───────────────────────────────────────────────────────
rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
rows = [r for r in rows if (r.get("one_liner") or "").strip() and (r.get("concept") or "").strip()]
by_part = {}
for r in rows: by_part.setdefault(r.get("part","?"), []).append(r)
parts = sorted(by_part, key=lambda p: -len(by_part[p]))
print(f"전체 개념 {len(rows)} · 도메인(part) {len(parts)}개: " +
      ", ".join(f"{p}({len(by_part[p])})" for p in parts))

# 도메인별 비례 표본, 총 ~N_TARGET
sample = []
for p in parts:
    k = max(8, round(N_TARGET * len(by_part[p]) / len(rows)))
    sample += random.sample(by_part[p], min(k, len(by_part[p])))
random.shuffle(sample)
sample = sample[:N_TARGET]
N = len(sample)
print(f"표본 {N}개 추출")

# ── 2) 텍스트 구성 & TF-IDF ──────────────────────────────────────────────────
STOP = set("the a an of to in and or for on with as by is are be that this it its their his her "
           "which who whom what how power between within into from at not no all our your they we "
           "human social study analysis concept theory idea notion form mode kind way being one".split())
def toks(s):
    return [t for t in re.findall(r"[a-z][a-z\-]{2,}", s.lower()) if t not in STOP]

docs_txt = [f'{r["concept"]} {r["concept"]} {r.get("one_liner","")} {r.get("major","")} {r.get("sub","")} {r.get("theorists","")}'
            for r in sample]
doc_toks = [toks(t) for t in docs_txt]

df = {}
for dt in doc_toks:
    for w in set(dt): df[w] = df.get(w,0)+1
vocab = sorted([w for w,c in df.items() if c>=2], key=lambda w:-df[w])[:5000]
vix = {w:i for i,w in enumerate(vocab)}
V = len(vocab)
idf = np.array([math.log((1+N)/(1+df[w]))+1 for w in vocab])

X = np.zeros((N, V))
for i,dt in enumerate(doc_toks):
    tf = {}
    for w in dt:
        if w in vix: tf[w]=tf.get(w,0)+1
    for w,c in tf.items():
        X[i, vix[w]] = (1+math.log(c)) * idf[vix[w]]
X /= (np.linalg.norm(X,axis=1,keepdims=True)+1e-9)   # L2 정규화
print(f"TF-IDF 행렬 {X.shape} (vocab {V})")

# ── 3) LSA: 그람행렬 고유분해로 잠재의미 임베딩 ─────────────────────────────────
t0=time.time()
G = X @ X.T                       # (N,N) 코사인 유사도(정규화됨)
w, U = np.linalg.eigh(G)          # 대칭 → 고유분해
order = np.argsort(w)[::-1]
w, U = w[order], U[:, order]
K = min(80, N-1)
Z = U[:, :K] * np.sqrt(np.maximum(w[:K], 1e-9))   # 문서 LSA 좌표 (N,K)
Z /= (np.linalg.norm(Z,axis=1,keepdims=True)+1e-9)
print(f"LSA {K}차원 임베딩 (eig {time.time()-t0:.2f}s)")

# ── 4) 2D 투영: LSA 코사인거리 → 고전MDS + SMACOF ───────────────────────────────
S = Z @ Z.T
D = 1 - S; np.fill_diagonal(D, 0); D = np.clip(D, 0, None)
J = np.eye(N) - np.ones((N,N))/N
B = -0.5 * J @ (D**2) @ J
wv, ev = np.linalg.eigh(B); o = np.argsort(wv)[::-1]
Xy = ev[:, o[:2]] * np.sqrt(np.maximum(wv[o[:2]], 0))
def smacof(D, Xinit, iters=120):
    n=len(D); Xc=Xinit.copy()
    for _ in range(iters):
        d=np.linalg.norm(Xc[:,None]-Xc[None],axis=2); d[d==0]=1e-9
        Bm=-D/d; np.fill_diagonal(Bm,0); np.fill_diagonal(Bm,-Bm.sum(1)); Xc=(Bm@Xc)/n
    return Xc
t0=time.time(); Xy = smacof(D, Xy, 120)
iu=np.triu_indices(N,1)
dd=np.linalg.norm(Xy[:,None]-Xy[None],axis=2)
stress=math.sqrt(((dd[iu]-D[iu])**2).sum()/(D[iu]**2).sum())
print(f"SMACOF 2D ({time.time()-t0:.2f}s) · Kruskal stress≈{stress:.3f}")

# kNN 그래프 평활화: 고차원 이웃끼리 2D에서 더 모이게(UMAP의 국소보존을 흉내) — 라벨 미사용
Sz = Z @ Z.T; np.fill_diagonal(Sz, -1)
KN = np.argsort(-Sz, axis=1)[:, :8]
for _ in range(25):
    nb = Xy[KN].mean(axis=1)               # 각 점의 고차원 이웃들의 2D 평균
    Xy = 0.7*Xy + 0.3*nb
    Xy = (Xy - Xy.mean(0)) / (Xy.std(0).mean()+1e-9)   # 붕괴 방지 재정규화
Xy = (Xy - Xy.mean(0)) / (np.abs(Xy).max()+1e-9) * 100

# ── 5) 진단: kNN purity (이웃이 같은 도메인인 비율) = 임베딩 품질 ───────────────
labels = [r.get("part","?") for r in sample]
def knn_purity(M, lab, k=10):
    Sm = M @ M.T; np.fill_diagonal(Sm, -1)
    nn = np.argsort(-Sm, axis=1)[:, :k]
    same = sum(1 for i in range(len(lab)) for j in nn[i] if lab[j]==lab[i])
    return same/(len(lab)*k)
print(f"kNN purity  (LSA {K}D): {knn_purity(Z,labels):.3f}")
print(f"kNN purity  (2D 투영): {knn_purity((Xy-Xy.mean(0)),labels):.3f}")
print(f"무작위 기대치(최대도메인 비율): {max(labels.count(p) for p in set(labels))/N:.3f}")

# ── 6) 영역(도메인) + 헐 + 출력 ─────────────────────────────────────────────────
PAL = ["#e85d75","#5bc0be","#f4a259","#9b5de5","#4895ef","#80b918","#ff7b00","#00b4d8",
       "#f15bb5","#fee440","#9b9b7a","#d00000","#7209b7","#06d6a0"]
part_color = {p: PAL[i%len(PAL)] for i,p in enumerate(parts)}

def hull(P):
    P=sorted(set(map(tuple,P)))
    if len(P)<=2: return P
    cr=lambda o,a,b:(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lo=[]
    for p in P:
        while len(lo)>=2 and cr(lo[-2],lo[-1],p)<=0: lo.pop()
        lo.append(p)
    up=[]
    for p in reversed(P):
        while len(up)>=2 and cr(up[-2],up[-1],p)<=0: up.pop()
        up.append(p)
    return lo[:-1]+up[:-1]

nodes=[]
for i,r in enumerate(sample):
    p=r.get("part","?")
    nodes.append(dict(
        id=f"c{i}", concept=r["concept"], theorist=r.get("theorists",""),
        year="", work=r.get("native",""), tradition=r.get("sub","") or r.get("major",""),
        film=r.get("major",""), film_dir=p, film_year="",
        en=r.get("one_liner",""), ko=r.get("one_liner",""),
        x=float(Xy[i,0]), y=float(Xy[i,1]), region=p, color=part_color[p]))

regions=[]
present_parts = [p for p in parts if any(n["region"]==p for n in nodes)]
for p in present_parts:
    pts=[[n["x"],n["y"]] for n in nodes if n["region"]==p]
    cx=sum(q[0] for q in pts)/len(pts); cy=sum(q[1] for q in pts)/len(pts)
    poly=[[float(x),float(y)] for x,y in hull(pts)] if len(pts)>=3 else []
    regions.append(dict(key=p, label=p, color=part_color[p],
                        centroid=[cx,cy], polygon=poly, n=len(pts)))

# 의미 이웃 엣지(상위 일부만 — 시각 과밀 방지)
edges=[]
Sknn = Z @ Z.T; np.fill_diagonal(Sknn,-1)
for i in range(N):
    j = int(np.argmax(Sknn[i]))
    if i<j and Sknn[i,j] >= 0.45:
        edges.append({"s":nodes[i]["id"],"t":nodes[j]["id"],"w":float(Sknn[i,j])})

atlas=dict(nodes=nodes, regions=regions, edges=edges,
           meta=dict(count=N, method="TF-IDF → LSA(SVD) → cosine MDS+SMACOF",
                     domains=len(present_parts), stress=round(stress,3)))
os.makedirs(os.path.join(OUT,"data"),exist_ok=True)
json.dump(atlas, open(os.path.join(OUT,"data","theory_atlas.json"),"w",encoding="utf-8"),
          ensure_ascii=False)
print(f"저장: nodes={N} regions={len(regions)} edges={len(edges)} → data/theory_atlas.json")
