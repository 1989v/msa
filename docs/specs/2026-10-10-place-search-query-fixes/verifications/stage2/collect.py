"""운영 검색 API(클러스터 안 주소)로 판정 세트 질의마다 상위 20개·건수·0건 사유·응답 시간을 모은다. 두 바퀴."""
import json, sys, time, urllib.parse, urllib.request
api, judg, out, label = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
qs = json.load(open(judg, encoding="utf-8"))
rows = []
for rnd in (1, 2):
    for item in qs:
        p = urllib.parse.urlencode({"keyword": item["query"], "lang": item["lang"], "size": 20, "sort": "relevance"})
        t0 = time.perf_counter()
        try:
            with urllib.request.urlopen(f"{api}?{p}", timeout=30) as r:
                d = json.load(r)["data"]
            ms = (time.perf_counter() - t0) * 1000
            rows.append({"round": rnd, "query": item["query"], "lang": item["lang"], "ms": round(ms, 1),
                         "ids": [str(a["id"]) for a in d["attractions"]], "total": d["totalElements"],
                         "zeroReason": d.get("zeroReason"), "corrected": d.get("correctedKeyword")})
        except Exception as e:
            rows.append({"round": rnd, "query": item["query"], "lang": item["lang"], "error": str(e)[:80]})
json.dump({"label": label, "at": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "rows": rows}, open(out, "w"), ensure_ascii=False)
ms = sorted(r["ms"] for r in rows if "ms" in r)
print(label, "rows", len(rows), "errors", sum("error" in r for r in rows), "p50", ms[len(ms)//2], "p99", ms[int(len(ms)*0.99)-1])
