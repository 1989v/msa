"""벡터 레그 knn 필터 비교 — A: 키워드 레그와 같은 bool(검색어 must 포함) / B: 구조 필터만.
읽기 전용: _search · /encode · GET 만 부른다."""
import json, math, re, sys, unicodedata, urllib.parse, urllib.request

OS, ENC, API, CONTENT = sys.argv[2:6]
MODEL = "microsoft/harrier-oss-v1-270m@31de22b#d640"
FIELDS = ["title^3", "title.en^3", "titleLocal^3", "overview", "overview.en", "address", "address.en"]
PIPE = "attraction-hybrid-rrf"; KNN_K = 100; OVERSAMPLE = 3.0; SIZE = 10
SIGHT, SIGHT_W = ["nature", "history", "culture", "leisure"], 3.0
COMMERCE, COMMERCE_W = ["shopping", "food"], 0.35

def req(url, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method="POST" if body is not None else "GET",
        headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "Mozilla/5.0 msa-exp"})
    with urllib.request.urlopen(r, timeout=timeout) as f:
        return json.load(f)

# ── QueryIntent 이식 (search/domain/.../QueryIntent.kt) ─────────────────────
def normalize(t): return re.sub(r"[\s‧·・/]", "", t.lower())
TYPE_INTENTS = {"관광지":"12","여행지":"12","명소":"12","가볼만한곳":"12","가볼만한 곳":"12","문화시설":"14","박물관":"14","미술관":"14",
                "축제":"15","행사":"15","공연":"15","레포츠":"28","체험":"28","숙박":"32"}
SETTING_INTENTS = {"실내":"indoor","실내관광지":"indoor","실내여행지":"indoor","비오는날":"indoor","비올때":"indoor",
                   "indoor":"indoor","rainyday":"indoor","rainydays":"indoor","야외":"outdoor","outdoor":"outdoor"}
FOOD = {"맛집","음식","음식점","먹거리","먹을거리","카페","술집","주점","food","restaurant","cafe"}
SHOP = {"시장","쇼핑","대여","렌탈","market","markets","shopping","rental","rent"}
SHOP_SUFFIXES = ["시장","market","markets"]
STOP = {"갈만한","가볼만한","가볼만","갈만","가기좋은","가기 좋은","좋은","괜찮은","추천","추천해줘","추천좀","어디","어디가","곳","데","장소","스팟","인기","유명한","유명","베스트","best"}
nSTOP = {normalize(x) for x in STOP}; nFOOD = {normalize(x) for x in FOOD}; nSHOP = {normalize(x) for x in SHOP}
nCOMM = nFOOD | nSHOP
nTYPE = {normalize(k): v for k, v in TYPE_INTENTS.items()}
nSET = {normalize(k): v for k, v in SETTING_INTENTS.items()}
RAINY = re.compile(r"비\s*(?:가\s*)?(?:오는\s*날|올\s*때)")
PAREN = re.compile(r"[(（]([^)）]*)[)）]"); SEP = re.compile(r"[.,/·∙‧・]")

def aliases(name):
    outside = PAREN.sub(" ", name)
    inside = " ".join(m for m in PAREN.findall(name) if SEP.search(m))
    return {normalize(x) for x in [name] + SEP.split(outside) + SEP.split(inside) if normalize(x).strip()}

def lexicon_of(rows):
    m = {}
    for code, depth, name in rows:
        keys = {normalize(name)} if code.startswith("EX06") else aliases(name)
        for k in keys:
            if k not in m or depth >= m[k][1]:
                m[k] = ((f"lclsSystm{depth}", code), depth)
    return {k: v[0] for k, v in m.items()}

def is_lcls(f): return f[0].startswith("lclsSystm")
def is_shop(n, lex):
    f = lex.get(n)
    return n in nSHOP or any(n.endswith(s) for s in SHOP_SUFFIXES) or (f is not None and is_lcls(f) and (f[1].startswith("SH") or f[1].startswith("AC")))
def is_food(n, lex):
    f = lex.get(n)
    return n in nFOOD or (f is not None and is_lcls(f) and f[1].startswith("FD"))
def match(n, lex):
    if n in nCOMM: return None
    if n in nTYPE: return {"contentTypeId": nTYPE[n]}
    if n in nSET: return {"setting": nSET[n]}
    f = lex.get(n)
    if f is not None:
        if is_lcls(f) and any(f[1].startswith(p) for p in ("FD","SH","AC")): return None
        return {f[0]: f[1]}
    return None

def analyze(raw_q, lex):
    raw = RAINY.sub(lambda m: re.sub(r"\s|가(?=\s*오)", "", m.group(0)), raw_q.strip())
    words = [w for w in re.split(r"\s+", raw) if w]
    if not words: return None, {}, False
    whole = normalize(raw)
    h = match(whole, lex)
    if h is not None: return None, h, False
    facets = {}; shop = is_shop(whole, lex); food = is_food(whole, lex); kept = []; i = 0
    while i < len(words):
        two = normalize(words[i] + words[i+1]) if i + 1 < len(words) else None
        one = normalize(words[i])
        if two is not None and is_shop(two, lex): shop = True
        if is_shop(one, lex): shop = True
        if two is not None and is_food(two, lex): food = True
        if is_food(one, lex): food = True
        th = match(two, lex) if two is not None else None
        if th is not None:
            for k, v in th.items(): facets.setdefault(k, v)
            i += 2; continue
        oh = match(one, lex)
        if oh is not None:
            for k, v in oh.items(): facets.setdefault(k, v)
            i += 1; continue
        if one not in nSTOP: kept.append(words[i])
        i += 1
    residual = " ".join(kept).strip() or None
    return residual, facets, shop and not food

def qnorm(raw):
    s = unicodedata.normalize("NFKC", raw); s = re.sub(r"\s+", " ", s).strip().lower()
    s = re.sub(r"[?!.,~\s]+$", "", s)
    if len(s) > 100: s = s[:100].strip()
    return s or None

# ── 질의 조립 (AttractionSearchAdapter.buildRequest) ─────────────────────────
def structural(lang, facets):
    f = [{"term": {"lang": {"value": lang}}}]
    f += [{"term": {k: {"value": v}}} for k, v in facets.items()]
    return f

def matched(residual, lang, facets):
    must = [{"multi_match": {"query": residual, "fields": FIELDS}}] if residual else [{"match_all": {}}]
    return {"bool": {"must": must, "filter": structural(lang, facets)}}

def keyword_leg(m, commerce):
    if commerce: return m
    return {"function_score": {"query": m, "functions": [
        {"filter": {"terms": {"category": SIGHT}}, "weight": SIGHT_W},
        {"filter": {"terms": {"category": COMMERCE}}, "weight": COMMERCE_W},
        {"field_value_factor": {"field": "popularityScore", "factor": 1.0, "modifier": "ln1p", "missing": 1.0}}],
        "score_mode": "multiply", "boost_mode": "multiply"}}

def vector_leg(vec, filt):
    return {"knn": {"embedding": {"vector": vec, "k": KNN_K, "rescore": {"oversample_factor": OVERSAMPLE},
        "filter": {"bool": {"filter": [filt, {"term": {"embeddingModel": {"value": MODEL}}}]}}}}}

def run(residual, lang, facets, commerce, vec, variant):
    m = matched(residual, lang, facets)
    vfilt = m if variant == "A" else {"bool": {"filter": structural(lang, facets)}}
    if residual is None:
        body = {"from": 0, "size": SIZE, "_source": False, "query": vector_leg(vec, m),
                "sort": [{"_score": {"order": "desc"}}, {"idSort": {"order": "asc", "unmapped_type": "long"}}, {"id": {"order": "asc"}}]}
        url = f"{OS}/attractions/_search"
    else:
        body = {"from": 0, "size": SIZE, "_source": False, "query": {"hybrid": {
            "queries": [keyword_leg(m, commerce), vector_leg(vec, vfilt)], "pagination_depth": max(SIZE, KNN_K)}}}
        url = f"{OS}/attractions/_search?search_pipeline={PIPE}"
    return [h["_id"] for h in req(url, body)["hits"]["hits"]]

def ndcg(ranked, grades, k=10):
    if not any(g > 0 for g in grades.values()): return None
    dcg = sum((2 ** grades.get(d, 0) - 1) / math.log2(i + 2) for i, d in enumerate(ranked[:k]))
    ideal = sorted(grades.values(), reverse=True)[:k]
    idcg = sum((2 ** g - 1) / math.log2(i + 2) for i, g in enumerate(ideal))
    return dcg / idcg if idcg else None

def main():
    qs = json.load(open(sys.argv[1], encoding="utf-8"))
    codes = req(f"{CONTENT}/api/places/attractions/category-codes")["data"]
    codes = [c for c in codes if c.get("name", "").strip() and c.get("code", "").strip()]
    langs = {c["lang"] for c in codes if c.get("lang")} or {"ko"}
    lexes = {l: lexicon_of([(c["code"], c["depth"], c["name"]) for c in codes if c["lang"] != l] +
                           [(c["code"], c["depth"], c["name"]) for c in codes if c["lang"] == l]) for l in langs}
    print("lexicon", {l: len(x) for l, x in lexes.items()}, flush=True)
    rows = []
    for n, it in enumerate(qs, 1):
        q, lang, grades = it["query"], it["lang"], it["grades"]
        r = {"query": q, "lang": lang}
        try:
            api = req(f"{API}?" + urllib.parse.urlencode({"keyword": q, "lang": lang, "size": SIZE, "sort": "relevance"}))["data"]
            r["api"] = [str(x["id"]) for x in api.get("attractions") or []]
            kw = api.get("correctedKeyword") or q
            r["corrected"] = api.get("correctedKeyword")
            residual, facets, commerce = analyze(kw, lexes.get(lang, {}))
            r.update(residual=residual, facets=facets, commerce=commerce)
            norm = qnorm(kw)
            vec = req(f"{ENC}/encode", {"query": norm})["vector"] if norm else None
            if not vec:
                r["error"] = "no-vector"; rows.append(r); continue
            r["A_ids"] = run(residual, lang, facets, commerce, vec, "A")
            r["B_ids"] = run(residual, lang, facets, commerce, vec, "B")
            r["A"], r["B"], r["API"] = ndcg(r["A_ids"], grades), ndcg(r["B_ids"], grades), ndcg(r["api"], grades)
            r["unjA"] = sum(1 for d in r["A_ids"] if d not in grades); r["unjB"] = sum(1 for d in r["B_ids"] if d not in grades)
        except Exception as e:
            r["error"] = str(e)[:200]
        rows.append(r)
        print(f"[{n:3d}] {lang} {q[:20]:<22} res={r.get('residual')!s:<14.14} A={r.get('A')} B={r.get('B')} "
              f"same_as_api={r.get('A_ids') == r.get('api')} {r.get('error','')}", flush=True)
    json.dump(rows, open(sys.argv[6], "w"), ensure_ascii=False, indent=1)

main()
