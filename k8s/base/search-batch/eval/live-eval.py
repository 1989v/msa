"""라이브 검색 3구성 nDCG@10.

  A. BM25 단독          — OpenSearch multi_match (앱과 같은 필드 가중)
  B. 하이브리드          — 위 + kNN, RRF. **쿼리 언더스탠딩 없음** (원문을 그대로 키워드로)
  C. 하이브리드 + QU     — 라이브 API (/api/search/attractions) 그대로

A·B 는 색인을 직접 질의해 구성을 통제하고, C 는 서비스가 실제로 내는 답을 쓴다.
셋 다 같은 인덱스·같은 lang 필터다.

매일 CronJob `search-eval` 이 재색인 뒤에 돌린다. C 가 기준선(EVAL_BASELINE_KO/EN)보다
EVAL_TOLERANCE 넘게 떨어지거나 질의가 하나라도 실패하면 종료 코드 1 — Job 이 Failed 로 남는다.

  python3 live-eval.py <판정.json> [결과.json]

판정 항목마다 질의 의도 유형(`intent`, 여덟 값)이 있고, 언어별 표 아래에 의도별 표를 낸다 — A/B/C nDCG@10 ·
0건율(라이브 응답 `totalElements == 0` 비율) · 판정 없는 top-10 비율. 정답이 「결과 없음」인 질의(`NO_ANSWER`)는
nDCG 평균에서 `intent` 로 빼고 빈 정답 통과율(`totalElements == 0` 비율)로 따로 본다 — `ndcg()` 의 `None` 에 맡기면
국내 대체지에 등급 1 이 있는 질의가 숫자를 내 평균에 섞인다. 게이트는 NO_ANSWER 를 뺀 C 평균, 질의 실패는 전체로 센다.
네트워크를 부르기 전에 판정 파일 형식(의도·출처 `evidence`·`graded_by`·검색어 개인정보)을 검사하고, 어기면 종료 코드 1.

클릭 계수 짝 비교 (`--click-boost-pair`) — 순위 스위치 `search.attraction.click-boost.enabled` 를 켜기 전에 돈다.
같은 색인 한 벌(별칭을 시작 때 실제 색인 이름으로 고정)에서 질의마다 앱의 키워드 레그를 계수 없이·계수를 곱해
두 번 내고 nDCG@10 을 짝지어 비교한다. 계수는 키워드 레그에만 붙으므로 비교도 키워드 레그로 한다.
판정: 판정 없는 문서 비율 > 20% 이거나 순서가 바뀐 질의가 10개 미만이면 보류(2) · 평균 차 < 0 이거나 0.05 넘게 나빠진 질의가 3개 이상이면
켜지 않음(1) · 그 외 켬(0). OpenSearch 만 부른다.

  python3 live-eval.py --click-boost-pair <판정.json> [결과.json]
  EVAL_CLICK_BOOST_EXPONENT=30 python3 live-eval.py --click-boost-pair …   # 회귀 주입: 계수를 30제곱해 과대하게
"""
import json, os, re, sys, unicodedata, urllib.parse, urllib.request

OS_URL   = os.environ.get("EVAL_OPENSEARCH_URL", "http://opensearch:9200")
ENC_URL  = os.environ.get("EVAL_ENCODER_URL", "http://search:8099")
API_URL  = os.environ.get("EVAL_API_URL", "http://search:8083/api/search/attractions")
MODEL_REF = os.environ.get("EVAL_MODEL_REF", "microsoft/harrier-oss-v1-270m@31de22b#d640")
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
    """라이브 응답 → (상위 id, 전체 건수, 교정된 검색어). 전체 건수가 없으면 예외 — 0 으로 두면 0건율이 조용히 100% 가 된다."""
    qs = urllib.parse.urlencode({"keyword": q, "lang": lang, "size": K, "sort": "relevance"})
    req = urllib.request.Request(f"{API_URL}?{qs}", headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.load(r)
    data = d.get("data") or {}
    if "totalElements" not in data:
        raise ValueError("응답에 totalElements 없음")
    ids = [str(x["id"]) for x in data.get("attractions") or []]
    return ids, data["totalElements"], data.get("correctedKeyword")


def ndcg(ranked, grades, k=K):
    if not any(g > 0 for g in grades.values()):
        return None
    import math
    dcg = sum((2 ** grades.get(d, 0) - 1) / math.log2(i + 2) for i, d in enumerate(ranked[:k]))
    ideal = sorted(grades.values(), reverse=True)[:k]
    idcg = sum((2 ** g - 1) / math.log2(i + 2) for i, g in enumerate(ideal))
    return dcg / idcg if idcg else None


# ── 판정 파일 형식 검사 ────────────────────────────────────────────────────────
# 위쪽이 이긴다(둘 이상에 걸리면 표의 위쪽 유형). 정의는 scripts/search-eval/README.md 「판정 세트 v3」.
INTENTS = ("NO_ANSWER", "TYPO", "ALIAS", "CONDITION", "NATURAL", "NAME", "REGION_TYPE", "CATEGORY")
DATE = r"\d{4}-\d{2}-\d{2}"
# 새 질의의 출처. 접두어마다 값 모양과 쓸 수 있는 유형이 정해져 있다(None = 전부).
EVIDENCE = {
    "events":   (re.compile(rf"events:{DATE}"), None),
    "codes":    (re.compile(r"codes:[A-Z]{2}[0-9]{0,6}"), {"CATEGORY", "REGION_TYPE"}),
    "attr":     (re.compile(r"attr:[A-Za-z]+=[A-Z_]+(&[A-Za-z0-9]+=[A-Z0-9_]+)*:[1-9][0-9]*"), {"CONDITION"}),
    "seed":     (re.compile(r"seed:intents\.yml"), {"NATURAL"}),
    "variant":  (re.compile(r"variant:(.+):(조사|띄어쓰기|어미)"), {"NATURAL"}),
    "title":    (re.compile(r"title:[0-9]+"), {"ALIAS"}),
    "synonym":  (re.compile(r"synonym:\S.*"), {"ALIAS"}),
    "romanize": (re.compile(r"romanize:[0-9]+:mr"), {"ALIAS"}),
    "edit":     (re.compile(r"edit:(.+):(받침|된소리|ㅐㅔ|띄어쓰기|철자누락|철자전치)"), {"TYPO"}),
    "zero":     (re.compile(r"zero:\S.*"), {"NO_ANSWER"}),
}
GRADED_BY = re.compile(rf"v2|human-{DATE}|(sonnet|claude)-[a-z0-9.-]+-{DATE}")
# 판정 파일은 ConfigMap 에 그대로 실린다 — 검색어에 연락처·주문번호·주소 꼴이 있으면 넣지 않는다
PRIVATE = re.compile(r"[0-9]{6,}|@|http|www\.|://", re.I)


def jamo(s):
    """한글을 자판에서 치는 자모 줄로 푼다 — 받침·된소리 한 번 바꿈, 「한라→할나」 같은 이웃 맞바꿈이 편집 거리 1 이 되게.
    받침(종성)은 같은 글자의 초성으로 맞춘다. 안 맞추면 「한라」의 받침 ㄴ 과 「할나」의 초성 ㄴ 이 다른 글자로 세어진다."""
    out = []
    for ch in unicodedata.normalize("NFD", s):
        ch = unicodedata.normalize("NFKC", ch)  # 낱자(ㅁㄴㅇㄹ)도 같은 자모로
        name = unicodedata.name(ch, "")
        if name.startswith("HANGUL JONGSEONG "):
            try:
                ch = unicodedata.lookup("HANGUL CHOSEONG " + name[len("HANGUL JONGSEONG "):])
            except KeyError:
                pass  # 겹받침(ㄳ 등)은 초성 짝이 없다 — 그대로 둔다
        out.append(ch)
    return "".join(out)


def edit_distance(a, b):
    """제한 Damerau-Levenshtein — 바꿈·넣기·빼기·이웃 두 글자 맞바꿈이 각각 1."""
    d = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        d[i][0] = i
    for j in range(len(b) + 1):
        d[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] != b[j - 1]))
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)
    return d[len(a)][len(b)]


def check_format(qs):
    """네트워크 없이 판정 파일을 검사해 위반 문구 목록을 낸다. 비어 있으면 통과."""
    bad = []
    known = {(x.get("lang"), x.get("query")) for x in qs}
    for n, x in enumerate(qs, 1):
        q, lang, intent = x.get("query"), x.get("lang"), x.get("intent")
        at = f"#{n} {lang} {q!r}"
        if intent not in INTENTS:
            bad.append(f"{at}: intent {intent!r} 가 여덟 값 밖")
        if intent != "NO_ANSWER" and not any(g > 0 for g in (x.get("grades") or {}).values()):
            # ndcg() 가 None 을 내 평균에서 조용히 빠진다 — 라벨 누락이 숫자에서 사라지지 않게 막는다
            bad.append(f"{at}: NO_ANSWER 가 아닌데 등급 >0 문서가 없다")
        ev = x.get("evidence")
        if ev != "v2":
            prefix = ev.split(":", 1)[0] if isinstance(ev, str) else None
            rule = EVIDENCE.get(prefix)
            m = rule[0].fullmatch(ev) if rule else None
            if not m:
                bad.append(f"{at}: evidence {ev!r} 가 v2 도 출처 형식도 아니다")
            elif rule[1] is not None and intent not in rule[1]:
                bad.append(f"{at}: evidence {prefix}: 는 {intent} 에 쓰지 않는다")
            elif prefix in ("edit", "variant"):
                orig = m.group(1)
                if (lang, orig) not in known:
                    bad.append(f"{at}: {prefix}: 의 원 질의 {orig!r} 가 같은 언어에 없다")
                elif prefix == "edit" and edit_distance(jamo(orig), jamo(q)) != 1:
                    bad.append(f"{at}: 원 질의 {orig!r} 와 편집 거리가 1 이 아니다")
        if not isinstance(x.get("graded_by"), str) or not GRADED_BY.fullmatch(x["graded_by"]):
            bad.append(f"{at}: graded_by {x.get('graded_by')!r} 형식이 아니다")
        if isinstance(q, str) and PRIVATE.search(q):
            bad.append(f"#{n} {lang}: 검색어에 개인정보 꼴(숫자 6자리 이상·@·URL)이 있다")
    return bad


# ── 클릭 계수 짝 비교 ────────────────────────────────────────────────────────
# 앱 키워드 레그(AttractionSearchAdapter.withCategoryWeights)의 점수 함수를 그대로 옮긴다.
# 분류 가중치는 search:app AttractionRankingProperties 기본값 · application.yml 과 같아야 한다.
SIGHT, SIGHT_W = ["nature", "history", "culture", "leisure"], 3.0
COMMERCE, COMMERCE_W = ["shopping", "food"], 0.35
PAIR_WORSE_BY, PAIR_WORSE_MAX, PAIR_UNJUDGED_MAX = 0.05, 3, 0.20
# 순서가 바뀐 질의가 이보다 적으면 판정하지 않는다(보류). 클릭 신호가 거의 없으면 계수가 전부 1.0 이라
# 순서가 안 바뀌고 Δ=0 이 되는데, 그것을 「평균 차 ≥ 0 → 켬」으로 읽으면 잰 것 없이 통과한다.
MIN_CHANGED = 10


def resolve_index(alias="attractions"):
    """별칭 → 지금 가리키는 실제 색인. 비교 도중 재색인이 별칭을 옮겨도 두 번의 질의가 같은 벌을 본다."""
    with urllib.request.urlopen(f"{OS_URL}/_alias/{alias}", timeout=30) as r:
        return next(iter(json.load(r)))


def keyword_leg(q, lang, click_boost, exponent=1.0):
    functions = [
        {"filter": {"terms": {"category": SIGHT}}, "weight": SIGHT_W},
        {"filter": {"terms": {"category": COMMERCE}}, "weight": COMMERCE_W},
        {"field_value_factor": {"field": "popularityScore", "factor": 1.0, "modifier": "ln1p", "missing": 1.0}},
    ]
    if click_boost:
        if exponent == 1.0:
            # 앱과 같은 모양
            functions.append({"field_value_factor": {"field": "clickBoost", "factor": 1.0, "missing": 1.0}})
        else:
            # 회귀 주입 전용 — 계수를 과대하게 만들어 게이트가 막는지 본다
            functions.append({"script_score": {"script": {
                "source": "Math.pow(doc['clickBoost'].size() == 0 ? 1.0 : doc['clickBoost'].value, params.e)",
                "params": {"e": exponent}}}})
    return {"function_score": {
        "query": {"bool": {"must": [{"multi_match": {"query": q, "fields": FIELDS}}],
                           "filter": [{"term": {"lang": {"value": lang}}}]}},
        "functions": functions, "score_mode": "multiply", "boost_mode": "multiply"}}


def ids_keyword(index, q, lang, click_boost, exponent=1.0):
    # 앱 키워드 단독 요청과 같은 정렬 — 점수 뒤 숫자 id 로 동점을 끊어 두 번의 결과가 흔들리지 않게 한다
    body = {"size": K, "_source": False, "query": keyword_leg(q, lang, click_boost, exponent),
            "sort": [{"_score": "desc"}, {"idSort": {"order": "asc", "unmapped_type": "long"}}, {"id": "asc"}]}
    d = post(f"{OS_URL}/{index}/_search", body)
    return [h["_id"] for h in d["hits"]["hits"]]


def click_boost_verdict(deltas, unjudged, total, changed):
    """짝지은 차(on − off) 목록 → (종료 코드, 판정, 수치). 0 켬 · 1 켜지 않음 · 2 보류."""
    mean = sum(deltas) / len(deltas) if deltas else 0.0
    worse = sum(1 for d in deltas if d < -PAIR_WORSE_BY)
    ratio = unjudged / total if total else 1.0
    stats = f"평균 ΔnDCG {mean:+.4f} · {PAIR_WORSE_BY} 넘게 나빠진 질의 {worse}개 · 판정 없는 문서 {ratio:.1%} ({unjudged}/{total})"
    if not deltas or ratio > PAIR_UNJUDGED_MAX:
        return 2, "보류 — 판정 없는 문서가 많아 차이를 믿을 수 없다(판정을 보강한 뒤 다시 잰다)", stats
    if changed < MIN_CHANGED:
        return 2, (f"보류 — 순서가 바뀐 질의가 {changed}개로 {MIN_CHANGED}개 미만이다"
                   "(클릭 신호가 쌓인 뒤 다시 잰다)"), stats
    if mean < 0 or worse >= PAIR_WORSE_MAX:
        return 1, "켜지 않음", stats
    return 0, "켬", stats


def click_boost_pair(path, out=None):
    qs = json.load(open(path, encoding="utf-8"))
    exponent = float(os.environ.get("EVAL_CLICK_BOOST_EXPONENT", "1"))
    index = resolve_index()
    print(f"  색인 {index} 고정 · 계수 지수 {exponent:g}{' (회귀 주입)' if exponent != 1.0 else ''}", flush=True)
    rows, deltas, unjudged, total, errors, changed = [], [], 0, 0, 0, 0
    for n, item in enumerate(qs, 1):
        q, lang, grades = item["query"], item["lang"], item["grades"]
        if item.get("intent") == "NO_ANSWER":
            # 정답이 없는 질의 — 등급 1 이 있으면 ndcg() 가 숫자를 내 짝 비교에 섞인다
            continue
        try:
            off = ids_keyword(index, q, lang, False)
            on = ids_keyword(index, q, lang, True, exponent)
        except Exception as e:
            errors += 1
            rows.append({"query": q, "lang": lang, "error": str(e)[:80]})
            print(f"  [{n:2d}/{len(qs)}] {lang} {q[:22]:<24} ERR {str(e)[:60]}", flush=True)
            continue
        n_off, n_on = ndcg(off, grades), ndcg(on, grades)
        unjudged += sum(1 for d in on if d not in grades)
        changed += on != off
        total += len(on)
        row = {"query": q, "lang": lang, "off": n_off, "on": n_on}
        if n_off is not None and n_on is not None:
            row["delta"] = n_on - n_off
            deltas.append(row["delta"])
        rows.append(row)
        delta = f" Δ={row['delta']:+.4f}" if "delta" in row else ""
        print(f"  [{n:2d}/{len(qs)}] {lang} {q[:22]:<24} off={n_off and round(n_off,4)} on={n_on and round(n_on,4)}{delta}",
              flush=True)
    if out:
        json.dump(rows, open(out, "w"), ensure_ascii=False, indent=1)
    code, verdict, stats = click_boost_verdict(deltas, unjudged, total, changed)
    if errors:
        code, verdict = 1, f"실패 — 질의 {errors}건이 오류라 판정하지 않는다"
    # 계수가 거의 전부 1.0 이면 순서가 안 바뀌어 차이가 0 이고 판정은 「켬」이 된다 — 켜도 달라지는 게 없다는 뜻이다
    print(f"\n  짝 {len(deltas)}개 · 순서가 바뀐 질의 {changed}개 · {stats}\n  판정: {verdict}", flush=True)
    return code


def main():
    qs = json.load(open(sys.argv[1], encoding="utf-8"))
    bad = check_format(qs)
    if bad:
        print(f"  판정 파일 형식 위반 {len(bad)}건 — 재지 않고 멈춘다", flush=True)
        for line in bad:
            print("  - " + line, flush=True)
        return 1
    rows = []
    for n, item in enumerate(qs, 1):
        q, lang, grades = item["query"], item["lang"], item["grades"]
        # 구성마다 따로 잡는다 — 하나가 실패해도 나머지 값을 버리지 않는다
        r = {"query": q, "lang": lang, "intent": item["intent"], "evidence": item["evidence"],
             "graded_by": item["graded_by"]}
        errs = []
        try:
            vec = encode(q)
        except Exception as e:
            vec = None; errs.append(f"enc:{str(e)[:40]}")
        for key, fn in (("A", lambda: ids_bm25(q, lang)),
                        ("B", (lambda: ids_hybrid(q, lang, vec)) if vec else None)):
            if fn is None:
                continue
            try:
                r[key] = ndcg(fn(), grades)
            except Exception as e:
                errs.append(f"{key}:{str(e)[:40]}")
        try:
            ids, total, corrected = ids_live(q, lang)
            r["C"] = ndcg(ids, grades)
            r["total_C"] = total
            r["returned_C"] = len(ids)
            r["unjudged_C"] = sum(1 for d in ids if d not in grades)
            r["zero_grade_C"] = sum(1 for d in ids if grades.get(d, 0) == 0)
            r["correctedKeyword"] = corrected
        except Exception as e:
            errs.append(f"C:{str(e)[:40]}")
        if errs:
            r["error"] = " · ".join(errs)
        rows.append(r)
        print(f"  [{n:2d}/{len(qs)}] {lang} {q[:22]:<24} "
              f"A={r.get('A') and round(r['A'],4)} B={r.get('B') and round(r['B'],4)} C={r.get('C') and round(r['C'],4)}"
              f" total={r.get('total_C')}{' ERR ' + r['error'] if 'error' in r else ''}", flush=True)
    if len(sys.argv) > 2:
        json.dump(rows, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)

    def avg(lang, key, sel=lambda r: True):
        # NO_ANSWER 는 정답이 없어 nDCG 를 내지 않는다 — ndcg() 의 None 이 아니라 intent 로 뺀다
        v = [r[key] for r in rows if r.get("lang") == lang and r["intent"] != "NO_ANSWER" and sel(r)
             and r.get(key) is not None]
        return sum(v) / len(v) if v else 0.0
    print("\n  구성                    ko       en")
    for key, name in (("A", "BM25 단독"), ("B", "하이브리드"), ("C", "하이브리드+QU")):
        print(f"  {name:<20} {avg('ko',key):.4f}  {avg('en',key):.4f}")
    v2 = lambda r: r["evidence"] == "v2"
    v2_kept = lambda r: r["evidence"] == "v2" and r["graded_by"] == "v2"
    print(f"  {'C · v2 150 질의만':<20} {avg('ko','C',v2):.4f}  {avg('en','C',v2):.4f}")
    print(f"  {'C · v2 146(재채점 제외)':<20} {avg('ko','C',v2_kept):.4f}  {avg('en','C',v2_kept):.4f}")
    for lang in ("ko", "en"):
        print_intents(rows, lang)
    err = [r for r in rows if "error" in r]
    if err:
        print(f"\n  실패 {len(err)}건: {err[0]['error']}")
    # 질의 실패는 NO_ANSWER 까지 센다 — 그 호출이 죽으면 빈 정답 통과율이 조용히 틀린다
    return gate(avg("ko", "C"), avg("en", "C"), len(err))


def ratio(num, den):
    return f"{num / den:.1%}" if den else "-"


def print_intents(rows, lang):
    """의도별 표 — 처음엔 보고만 한다(유형당 질의가 10~20개라 하루 흔들림이 크다)."""
    groups = []
    for intent in INTENTS:
        if intent == "NATURAL":
            # 의도 사전(seed) 문구는 질의 벡터 사전에 미리 들어 있어 벡터 레그가 맞히게 되어 있다 — 따로 본다
            groups.append(("NATURAL·seed", lambda r: r["intent"] == "NATURAL" and r["evidence"].startswith("seed:")))
            groups.append(("NATURAL·그 밖", lambda r: r["intent"] == "NATURAL" and not r["evidence"].startswith("seed:")))
        else:
            groups.append((intent, lambda r, i=intent: r["intent"] == i))
    print(f"\n  [{lang}] 의도          질의     A       B       C     0건율  판정없음  빈정답통과  top10등급0")
    for name, sel in groups:
        g = [r for r in rows if r["lang"] == lang and sel(r)]
        if not g:
            continue
        live = [r for r in g if r.get("total_C") is not None]
        returned = sum(r["returned_C"] for r in live)
        unjudged = ratio(sum(r["unjudged_C"] for r in live), returned)
        if name == "NO_ANSWER":
            passed = ratio(sum(1 for r in live if r["total_C"] == 0), len(live))
            zero = ratio(sum(r["zero_grade_C"] for r in live), returned)
            print(f"  {name:<14} {len(g):>4}       -       -       -       -  {unjudged:>8}  {passed:>10}  {zero:>10}")
            continue

        def mean(key):
            v = [r[key] for r in g if r.get(key) is not None]
            return f"{sum(v) / len(v):.4f}" if v else "     -"
        zero_rate = ratio(sum(1 for r in live if r["total_C"] == 0), len(live))
        print(f"  {name:<14} {len(g):>4}  {mean('A')}  {mean('B')}  {mean('C')}  {zero_rate:>6}  {unjudged:>8}")


def gate(c_ko, c_en, n_err):
    """기준선 대비 C 하락 판정. 기준선이 없으면 재기만 하고 통과시킨다."""
    tol = float(os.environ.get("EVAL_TOLERANCE", "0.03"))
    base = {"ko": os.environ.get("EVAL_BASELINE_KO"), "en": os.environ.get("EVAL_BASELINE_EN")}
    fails = [f"질의 실패 {n_err}건"] if n_err else []
    for lang, got in (("ko", c_ko), ("en", c_en)):
        if base[lang] and got < float(base[lang]) - tol:
            fails.append(f"C {lang} {got:.4f} < 기준선 {float(base[lang]):.4f} - {tol}")
    print("\n  판정: " + ("회귀 — " + " · ".join(fails) if fails else "통과"), flush=True)
    return 1 if fails else 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--click-boost-pair":
        sys.exit(click_boost_pair(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None))
    sys.exit(main())
