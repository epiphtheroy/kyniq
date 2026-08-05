#!/bin/zsh
# post-deploy-check — the smallest set of requests that would have caught each of
# the 2026-08-06 failures. Run once right after a deploy.
#
#   zsh scripts/post-deploy-check.sh
#   zsh scripts/post-deploy-check.sh https://metatake-git-branch.vercel.app   # preview
#
# Read-only: it fetches pages a visitor would fetch. It cannot see 429s that only
# a crawler would trigger — check the Vercel dashboard for those 15 minutes in.
set -u
BASE=${1:-https://metatake.net}
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
fails=0

say() { printf '%-46s %s\n' "$1" "$2"; }

check() { # path expected_code label
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" --max-time 30 "$BASE$1")
  if [ "$code" = "$2" ]; then say "$3" "✓ $code"
  else say "$3" "✗ $code (기대 $2)"; fails=$((fails+1)); fi
  sleep 0.5
}

echo "== $BASE =="
echo "-- 페이지가 살아 있는가 (null-poison 회귀) --"
check /                                   200 "홈"
check /film/parasite-2019                 200 "영화 상세"
check /film/parasite-2019/reception       200 "영화 리셉션"
check /film/solaris-1972/credits          200 "영화 크레딧"
check /director/ingmar-bergman            200 "감독"
check /trope/the-cosmos-audited-as-ledger 200 "트로프"
check /takescore/film/parasite-2019       200 "TakeScore"
check /ko/film/parasite-2019              200 "한국어 필름"

echo "-- figure 페이지 (병렬화·스로틀 회귀) --"
figure=$(curl -s -A "$UA" --max-time 30 "$BASE/film/parasite-2019" \
  | grep -oE '/film/parasite-2019/figure/[a-z0-9-]+' | head -1)
if [ -n "${figure:-}" ]; then check "$figure" 200 "figure ${figure##*/}"
else say "figure" "· 링크를 못 찾음 (수동 확인)"; fi

echo "-- 홈이 실제로 내용을 담고 있는가 --"
# grep -c counts LINES, and this HTML is one long line — it would answer 1 no
# matter how many posters there are. Count occurrences.
posters=$(curl -s -A "$UA" --max-time 40 "$BASE/" | grep -o 'image.tmdb.org' | wc -l | tr -d ' ')
if [ "$posters" -ge 5 ]; then say "홈 포스터" "✓ ${posters}개"
else say "홈 포스터" "✗ ${posters}개 — 빈 섹션이 캐시됐을 수 있음"; fails=$((fails+1)); fi

pins=$(curl -s -A "$UA" --max-time 60 "$BASE/api/geo?mode=overview" \
  | python3 -c 'import json,sys
try: print(len(json.load(sys.stdin)))
except Exception: print(0)')
if [ "$pins" -ge 1000 ]; then say "지도 개요 핀" "✓ ${pins}개"
else say "지도 개요 핀" "✗ ${pins}개 — 빈 지도가 CDN에 캐시됨"; fails=$((fails+1)); fi

echo "-- 프리페치가 429를 맞지 않는가 (실사용자 회귀) --"
p429=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  c=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" \
        -H 'Next-Router-Prefetch: 1' -H 'RSC: 1' --max-time 20 "$BASE/film/parasite-2019")
  [ "$c" = "429" ] && p429=$((p429+1))
done
if [ "$p429" -eq 0 ]; then say "프리페치 10연타" "✓ 429 없음"
else say "프리페치 10연타" "✗ 429 ${p429}회 — 상한이 독자를 막고 있음"; fails=$((fails+1)); fi

echo
if [ "$fails" -eq 0 ]; then
  echo "✅ 전부 통과. 15분 뒤 Vercel에서 504·429·500을 한 번 더 보라."
else
  echo "🚨 ${fails}건 실패 — 롤백을 먼저 고려하라. 위 실패 항목이 원인 지점이다."
fi
exit $fails
