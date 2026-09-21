"""라이브 검색 3구성 nDCG@10.

  A. BM25 단독          — OpenSearch multi_match (앱과 같은 필드 가중)
  B. 하이브리드          — 위 + kNN, RRF. **쿼리 언더스탠딩 없음** (원문을 그대로 키워드로)
  C. 하이브리드 + QU     — 라이브 API (/api/search/attractions) 그대로

A·B 는 색인을 직접 질의해 구성을 통제하고, C 는 서비스가 실제로 내는 답을 쓴다.
셋 다 같은 인덱스·같은 lang 필터다.
"""
import json, sys, urllib.parse, urllib.request

OS_URL   = "http://127.0.0.1:19200"
ENC_URL  = "http://127.0.0.1:18099"
API_URL  = "https://place.1989v.com/api/search/attractions"
MODEL_REF = "microsoft/harrier-oss-v1-270m@31de22b#d640"
FIELDS = ["title^3", "title.en^3", "titleLocal^3", "overview", "overview.en", "address", "address.en"]
K, RRF_K = 10, 60


def post(url, body, timeout=30):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def encode(q):
    return post(f"{ENC_URL}/encode", {"query": q})["vector"]


def search(body):
    d = post(f"{OS_URL}/attractions/_search", body)
    return [h["_id"] for h in d["hits"]["hits"]]


def ids_bm25(q, lang):
    return search({"size": K, "_source": False, "query": {"bool": {
        "must": [{"multi_match": {"query": q, "fields": FIELDS}}],
        "filter": [{"term": {"lang": lang}}]}}})


def ids_hybrid(q, lang, vec):
    filt = [{"term": {"lang": lang}}]
    kw = {"bool": {"must": [{"multi_match": {"query": q, "fields": FIELDS}}], "filter": filt}}
    kn = {"knn": {"embedding": {"vector": vec, "k": 100,
          "filter": {"bool": {"filter": filt + [{"term": {"embeddingModel": MODEL_REF}}]}}}}}
    a = search({"size": K, "_source": False, "query": kw})
    b = search({"size": K, "_source": False, "query": kn})
    # RRF — 파이프라인 없이 앱과 같은 상수로 합친다
    score = {}
    for lst in (a, b):
        for i, x in enumerate(lst):
            score[x] = score.get(x, 0.0) + 1.0 / (RRF_K + i + 1)
    return [x for x, _ in sorted(score.items(), key=lambda kv: -kv[1])][:K]


# 엣지(Cloudflare)가 기본 urllib UA 를 403 으로 막는다 — place_client 와 같은 이유.
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 msa-eval"


def ids_live(q, lang):
    qs = urllib.parse.urlencode({"keyword": q, "lang": lang, "size": K, "sort": "relevance"})
    req = urllib.request.Request(f"{API_URL}?{qs}", headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.load(r)
    return [str(x["id"]) for x in (d.get("data") or {}).get("attractions") or []]


def ndcg(ranked, grades, k=K):
    if not any(g > 0 for g in grades.values()):
        return None
    import math
    dcg = sum((2 ** grades.get(d, 0) - 1) / math.log2(i + 2) for i, d in enumerate(ranked[:k]))
    ideal = sorted(grades.values(), reverse=True)[:k]
    idcg = sum((2 ** g - 1) / math.log2(i + 2) for i, g in enumerate(ideal))
    return dcg / idcg if idcg else None


def main():
    qs = json.load(open(sys.argv[1], encoding="utf-8"))
    rows = []
    for n, item in enumerate(qs, 1):
        q, lang, grades = item["query"], item["lang"], item["grades"]
        # 구성마다 따로 잡는다 — 하나가 실패해도 나머지 값을 버리지 않는다
        r = {"query": q, "lang": lang}
        errs = []
        try:
            vec = encode(q)
        except Exception as e:
            vec = None; errs.append(f"enc:{str(e)[:40]}")
        for key, fn in (("A", lambda: ids_bm25(q, lang)),
                        ("B", (lambda: ids_hybrid(q, lang, vec)) if vec else None),
                        ("C", lambda: ids_live(q, lang))):
            if fn is None:
                continue
            try:
                r[key] = ndcg(fn(), grades)
            except Exception as e:
                errs.append(f"{key}:{str(e)[:40]}")
        if errs:
            r["error"] = " · ".join(errs)
        rows.append(r)
        print(f"  [{n:2d}/{len(qs)}] {lang} {q[:22]:<24} "
              f"A={r.get('A') and round(r['A'],4)} B={r.get('B') and round(r['B'],4)} C={r.get('C') and round(r['C'],4)}"
              f"{' ERR ' + r['error'] if 'error' in r else ''}", flush=True)
    json.dump(rows, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)

    def avg(lang, key):
        v = [r[key] for r in rows if r.get("lang") == lang and r.get(key) is not None]
        return sum(v) / len(v) if v else 0.0
    print("\n  구성                    ko       en")
    for key, name in (("A", "BM25 단독"), ("B", "하이브리드"), ("C", "하이브리드+QU")):
        print(f"  {name:<20} {avg('ko',key):.4f}  {avg('en',key):.4f}")
    err = [r for r in rows if "error" in r]
    if err:
        print(f"\n  실패 {len(err)}건: {err[0]['error']}")


if __name__ == "__main__":
    main()
