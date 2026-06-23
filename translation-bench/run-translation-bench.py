#!/usr/bin/env python3
"""
번역 모델 4종 벤치마크 — Gemini 2종(Pro/Flash) + Claude 2종(Opus/Sonnet)
같은 영화비평 텍스트를 동일 프롬프트로 번역하고,
각 API가 돌려주는 '실제' 입력/출력 토큰 수와 비용을 측정한다.

사용법 (MetaTake 폴더에서 키가 읽히는 환경):
    python3 translation-bench/run-translation-bench.py
    python3 translation-bench/run-translation-bench.py --list      # 사용 가능한 모델 ID 확인
    python3 translation-bench/run-translation-bench.py --haiku      # Haiku 4.5도 함께
키는 ../.env.local 의 ANTHROPIC_API_KEY, GEMINI_API_KEY 를 자동으로 읽는다.
"""
import os, sys, json, time, urllib.request, urllib.error, pathlib

# ── 가격표 (USD / 1M tokens, 2026-06 기준; 필요시 수정) ─────────────
PRICES = {
    "claude-opus-4-8":      {"in": 5.00, "out": 25.00, "label": "Claude Opus 4.8  (Claude 상)"},
    "claude-sonnet-4-6":    {"in": 3.00, "out": 15.00, "label": "Claude Sonnet 4.6 (Claude 중)"},
    "gemini-2.5-pro":       {"in": 1.25, "out": 10.00, "label": "Gemini 2.5 Pro  (Gemini 상)"},
    "gemini-2.5-flash":     {"in": 0.30, "out":  2.50, "label": "Gemini 2.5 Flash (Gemini 중)"},
    "gemini-3.1-pro-preview": {"in": 2.00, "out": 12.00, "label": "Gemini 3.1 Pro Preview (신규)"},
    "claude-haiku-4-5":     {"in": 1.00, "out":  5.00, "label": "Claude Haiku 4.5 (보너스)"},
}
USD_KRW = 1380  # 환율(표시용)

SYSTEM_PROMPT = (
    "You are a literary translator rendering English film-criticism into Korean. "
    "Preserve the critical register and the aphoristic cadence of the '↪ leap:' turn lines. "
    "Use established Korean academic equivalents for theory terms: "
    "objet petit a→대상 a, méconnaissance→오인, jouissance→주이상스, the Real→실재(the Real), "
    "mirror stage→거울 단계, biopower→생명권력, signifier/signified→기표/기의, auteur→작가(auteur). "
    "Keep film titles in standard Korean forms (Swan Lake→백조의 호수, The Red Shoes→분홍신). "
    "Output Korean only, preserving the original structure (title · metadata · body · ↪ 도약)."
)

ROOT = pathlib.Path(__file__).resolve().parent
SRC_FILE = ROOT / "source_en.txt"


def load_env():
    """가까운 .env.local 을 위로 올라가며 찾아 키를 읽는다."""
    d = ROOT
    for _ in range(5):
        f = d / ".env.local"
        if f.exists():
            for line in f.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                v = v.strip().strip('"').strip("'")
                os.environ.setdefault(k.strip(), v)
            return
        d = d.parent


def _post(url, data, headers, timeout=120):
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def call_anthropic(model, text):
    key = os.environ["ANTHROPIC_API_KEY"]
    body = {
        "model": model, "max_tokens": 4096, "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": text}],
    }
    h = {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    j = _post("https://api.anthropic.com/v1/messages", body, h)
    out = "".join(b.get("text", "") for b in j.get("content", []))
    u = j.get("usage", {})
    return out, u.get("input_tokens", 0), u.get("output_tokens", 0)


def call_gemini(model, text):
    key = os.environ["GEMINI_API_KEY"]
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": text}]}],
        "generationConfig": {"maxOutputTokens": 8192, "temperature": 0.7},
    }
    j = _post(url, body, {"content-type": "application/json"})
    cand = j.get("candidates", [{}])[0]
    out = "".join(p.get("text", "") for p in cand.get("content", {}).get("parts", []))
    m = j.get("usageMetadata", {})
    return out, m.get("promptTokenCount", 0), m.get("candidatesTokenCount", 0)


PROVIDER = {
    "claude-opus-4-8": call_anthropic, "claude-sonnet-4-6": call_anthropic,
    "claude-haiku-4-5": call_anthropic,
    "gemini-2.5-pro": call_gemini, "gemini-2.5-flash": call_gemini,
    "gemini-3.1-pro-preview": call_gemini,
}


def list_models():
    print("── Anthropic models ──")
    try:
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/models",
            headers={"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01"})
        for m in json.loads(urllib.request.urlopen(req, timeout=30).read())["data"]:
            print("  ", m["id"])
    except Exception as e:
        print("  (error)", e)
    print("── Gemini models ──")
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={os.environ['GEMINI_API_KEY']}"
        for m in json.loads(urllib.request.urlopen(url, timeout=30).read()).get("models", []):
            if "generateContent" in m.get("supportedGenerationMethods", []):
                print("  ", m["name"].split("/")[-1])
    except Exception as e:
        print("  (error)", e)


def main():
    load_env()
    if "--list" in sys.argv:
        list_models(); return
    if not SRC_FILE.exists():
        sys.exit(f"원문 파일이 없습니다: {SRC_FILE}")
    text = SRC_FILE.read_text()

    models = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3.1-pro-preview", "claude-sonnet-4-6", "claude-opus-4-8"]
    if "--haiku" in sys.argv:
        models.insert(0, "claude-haiku-4-5")

    rows = []
    for model in models:
        label = PRICES[model]["label"]
        print(f"\n=== {label}  [{model}] ===")
        try:
            t0 = time.time()
            out, tin, tout = PROVIDER[model](model, text)
            dt = time.time() - t0
        except urllib.error.HTTPError as e:
            print("  HTTP", e.code, e.read().decode()[:200]); continue
        except Exception as e:
            print("  ERROR", e); continue
        usd = tin / 1e6 * PRICES[model]["in"] + tout / 1e6 * PRICES[model]["out"]
        (ROOT / f"out_{model}.txt").write_text(out)
        rows.append((label, tin, tout, usd, dt))
        print(f"  입력 {tin} tok · 출력 {tout} tok · {dt:.1f}s · ${usd:.4f} (~{usd*USD_KRW:.0f}원/편)")
        print("  ── 미리보기 ──")
        print("\n".join("  " + l for l in out.splitlines()[:6]))

    print("\n\n================  요약 (이 글 1편 기준)  ================")
    print(f"{'모델':<28}{'입력tok':>8}{'출력tok':>8}{'$/편':>10}{'원/편':>9}{'전체*':>10}")
    for label, tin, tout, usd, dt in rows:
        corpus = usd * 7264 / 11  # 이 글=약 11 takes → meta_takes 7,264행 환산
        print(f"{label:<28}{tin:>8}{tout:>8}{usd:>10.4f}{usd*USD_KRW:>9.0f}{'$'+format(corpus,'.0f'):>10}")
    print("* 전체 = meta_takes 약 7,264행을 같은 단가로 1회 번역 시 대략치 (배치 API 적용 시 −50%)")


if __name__ == "__main__":
    main()
