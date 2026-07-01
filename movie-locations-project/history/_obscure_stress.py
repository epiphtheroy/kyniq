# -*- coding: utf-8 -*-
# obscure 6편 스트레스 테스트: 실제 웹검색에서 나온 도메인만 출처로 귀속 → judge() 등급화.
# (도메인은 각 영화 검색 결과 링크/요약에서 그 촬영지를 다룬 사이트만 보수적으로 귀속)
import json, collections
import movie_locations_llmsearch as A

# (real_name, narrative_setting, built_set, set_host, scene_role, address, area, country, granularity, [domains])
DATA = {
 ("Wake in Fright",1971): [
  ("Sulphide Street Railway Station","'Bundanyabba' station",False,"","Where the protagonist arrives by train","","Broken Hill, NSW","Australia","venue",["en.wikipedia.org","reelstreets.com","imdb.com"]),
  ("Old Broken Hill Hospital","'Bundanyabba'",False,"","Town hospital glimpsed in the film","","Broken Hill, NSW","Australia","venue",["en.wikipedia.org"]),
  ("Silverton, NSW","outback town",False,"","Outback exterior scenes","","Silverton, NSW","Australia","area",["en.wikipedia.org","imdb.com"]),
  ("Menindee Lakes","outback",False,"","Lake/outback scenes","","Menindee, NSW","Australia","area",["en.wikipedia.org"]),
  ("Ajax Studios, Bondi","interiors",True,"Ajax Studios, Bondi (Sydney)","Interior sets","Bondi","Sydney","Australia","set",["en.wikipedia.org"]),
 ],
 ("Save the Green Planet!",2003): [
  ("Unnamed coal-mining town","Byeong-gu's retro house area",False,"","Retro mining-town setting (no specific place named)","","South Korea","South Korea","region",["grokipedia.com"]),
  ("Seoul streets","urban chase",False,"","City chase sequences (unspecified streets)","","Seoul","South Korea","area",["grokipedia.com"]),
 ],
 ("Spoorloos (The Vanishing)",1988): [
  ("Rest stop near Nimes","the vanishing spot",False,"","Service station where Saskia disappears","","Nimes, Languedoc","France","area",["en.wikipedia.org"]),
  ("Gas station, Place du General Tessier de Marguerittes","roadside stop",False,"","Identified filming gas station","Marguerittes 30320","Marguerittes","France","address",["filmap.tumblr.com"]),
 ],
 ("Withnail and I",1987): [
  ("Sleddale Hall ('Crow Crag')","Monty's cottage",False,"","Monty's remote cottage","near Shap","Cumbria","England, UK","venue",["almostginger.com","en.wikipedia.org","movie-locations.com"]),
  ("River Lowther bridge","fishing scene",False,"","Shotgun-fishing bridge","","Cumbria","England, UK","venue",["almostginger.com","movie-locations.com"]),
  ("57 Chepstow Place, Bayswater","Camden flat",False,"","Withnail & Marwood's flat","57 Chepstow Place, W2","London","England, UK","address",["en.wikipedia.org","almostginger.com"]),
  ("Stony Stratford market square","'Penrith' pub & tea rooms",False,"","King Henry pub / tea-room scenes","Stony Stratford, Milton Keynes","Buckinghamshire","England, UK","area",["almostginger.com","en.wikipedia.org"]),
  ("London Zoo wolf enclosure","closing monologue",False,"","Final speech by the wolves","Regent's Park","London","England, UK","venue",["en.wikipedia.org","almostginger.com"]),
 ],
 ("Aguirre, the Wrath of God",1972): [
  ("Huayna Picchu stairway, Machu Picchu","opening descent",False,"","Procession down the Inca stairway","Machu Picchu","Cusco","Peru","venue",["en.wikipedia.org","bfi.org.uk","movie-locations.com"]),
  ("Huallaga & Nanay rivers, Ucayali","Amazon river journey",False,"","Raft journey down the river","Ucayali region","Loreto","Peru","area",["en.wikipedia.org","imdb.com"]),
 ],
 ("The Long Good Friday",1980): [
  ("North Quay, West India Dock","Harold's yacht mooring",False,"","Yacht moored in docklands (now Canary Wharf)","West India Dock","London","England, UK","venue",["bfi.org.uk","movie-locations.com"]),
  ("St George in the East Church, Wapping","car-bomb church",False,"","Church where the car bomb explodes","14 Cannon Street Road, E1","London","England, UK","address",["movie-locations.com","bfi.org.uk"]),
  ("Waterman's Arms pub, Isle of Dogs","gangland pub",False,"","Pub appearing in the film","1 Glenaffric Ave, E14","London","England, UK","address",["movie-locations.com"]),
  ("Bethnal Green Town Hall","Councillor's office",False,"","Art-deco town hall office","Patriot Square, E2","London","England, UK","venue",["movie-locations.com","londononlocation.co.uk"]),
 ],
}

def as_urls(domains):
    return [f"https://{d}/" for d in domains]

movies=[]; dist=collections.Counter(); rows=[]
for (title,year),locs in DATA.items():
    L=[]
    for (rn,ns,bs,sh,sr,ad,ar,co,gr,dom) in locs:
        loc={"real_name":rn,"narrative_setting":ns,"built_set":bs,"set_host":sh,
             "scene_role":sr,"address":ad,"filming_area":ar,"country":co,
             "granularity":gr,"sources":as_urls(dom)}
        A.judge(loc, min_sources=2)
        loc["sources"]=dom  # 표시용 도메인 복원
        dist[loc["confidence"]]+=1
        L.append(loc); rows.append((title,rn,loc["confidence"],loc["top_tier"],", ".join(dom)))
    movies.append({"title":title,"year":year,"location_count":len(L),"locations":L})

json.dump({"method":"LLM+web search obscure stress test (real search domains)","movie_count":len(movies),
           "tier_distribution":dict(dist),"movies":movies},
          open("llmsearch_obscure.json","w",encoding="utf-8"),ensure_ascii=False,indent=2)

print("=== obscure 6편 실제 등급 분포 ===")
order=["verified","verified_set_not_real","probable","weak","quarantined_legal","rejected","unverified"]
for k in order:
    if dist.get(k): print(f"  {k:<22} {dist[k]}")
print(f"  합계 {sum(dist.values())}")
ship=dist["verified"]+dist["verified_set_not_real"]+dist["probable"]
print(f"  → 배포(SHIPPABLE: verified+probable) {ship} / 격리 {dist['quarantined_legal']} / 검토 weak {dist['weak']}")
print("\n=== 항목별 판정 ===")
for t,rn,c,tier,dom in rows:
    print(f"  [{c:<20}] {t} | {rn}  (tier {tier}; {dom})")
