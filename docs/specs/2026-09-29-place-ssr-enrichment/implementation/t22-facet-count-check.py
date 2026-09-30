#!/usr/bin/env python3
"""T22 — 배포 뒤 속성 패싯 건수 = 같은 필터로 OpenSearch 에 직접 낸 `_count`.

공개 검색 API 가 돌려준 `attributeFacets` 의 값마다, 같은 조건(구조 필터 + 자기 속성만 뺀 나머지 선택 +
그 값)을 이 스크립트가 **따로** 만든 `_count` 질의와 대조한다. 질의는 어댑터 코드를 부르지 않고 스펙(SR-3)
문장에서 직접 짠다 — 어댑터가 틀리면 둘이 어긋나야 하기 때문이다. 읽기 전용이다.

  kubectl -n <ns> port-forward svc/opensearch 9200:9200 &
  python3 t22-facet-count-check.py                       # 기본: https://1989v.com , http://localhost:9200
  API_URL=... OS_URL=... python3 t22-facet-count-check.py

종료 코드: 전부 일치 0 · 하나라도 어긋나면 1.
"""
import datetime
import json
import os
import sys
import urllib.parse
import urllib.request

API_URL = os.environ.get("API_URL", "https://1989v.com/api/search/attractions")
OS_URL = os.environ.get("OS_URL", "http://localhost:9200")
INDEX = os.environ.get("OS_INDEX", "attractions")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"
KST = datetime.timezone(datetime.timedelta(hours=9))
WEEKDAY = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

# 대조할 요청. 검색어 없는 것은 텍스트·하이브리드 어느 경로든 같은 건수여야 한다.
CASES = [
    {"lang": "ko"},
    {"lang": "ko", "parking": "YES"},
    {"lang": "ko", "sidoCode": "11", "pet": "ALLOWED,PARTIAL", "openToday": "true"},
    {"lang": "ko", "category": "nature,history", "creditCard": "YES", "admission": "FREE"},
    {"lang": "ko", "lat": "37.5796", "lng": "126.977", "radiusKm": "5", "strollerRental": "YES"},
    # 검색어가 있으면 운영 경로(텍스트/하이브리드)에 따라 질의어 반영 여부가 갈린다 — 둘 다 재서 어느 쪽인지 적는다
    {"lang": "ko", "keyword": "한옥", "parking": "YES"},
]


def http_json(url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read())


def term(field, value):
    return {"term": {field: value}}


def open_today(day):
    return {"bool": {"minimum_should_match": 1, "should": [
        {"terms": {"closureState": ["ALWAYS_OPEN", "NO_WEEKLY"]}},
        {"bool": {"filter": [term("closureState", "WEEKLY")], "must_not": [term("closedWeekdays", day)]}},
    ]}}


def selections(case, day):
    """요청 파라미터 → 속성별 선택 필터 (긍정 값만)."""
    sel = {}
    if case.get("openToday") == "true":
        sel["openToday"] = open_today(day)
    for key, field in (("parking", "attrParking"), ("creditCard", "attrCreditCard"), ("strollerRental", "attrStrollerRental")):
        if case.get(key) == "YES":
            sel[key] = term(field, "YES")
    pets = [p for p in case.get("pet", "").split(",") if p in ("ALLOWED", "PARTIAL")]
    if pets:
        sel["pet"] = {"terms": {"petPolicy": pets}}
    if case.get("admission") == "FREE":
        sel["admission"] = term("attrAdmission", "FREE")
    return sel


def buckets(day):
    """(응답 경로, 속성, 조건) — UNKNOWN·부정 값은 없다."""
    return [
        (("openToday",), "openToday", open_today(day)),
        (("parking", "YES"), "parking", term("attrParking", "YES")),
        (("creditCard", "YES"), "creditCard", term("attrCreditCard", "YES")),
        (("strollerRental", "YES"), "strollerRental", term("attrStrollerRental", "YES")),
        (("pet", "ALLOWED"), "pet", term("petPolicy", "ALLOWED")),
        (("pet", "PARTIAL"), "pet", term("petPolicy", "PARTIAL")),
        (("admission", "FREE"), "admission", term("attrAdmission", "FREE")),
    ]


def structure(case, with_text):
    filters = []
    if case.get("lang"):
        filters.append(term("lang", case["lang"]))
    if case.get("sidoCode"):
        filters.append(term("ldongRegnCd", case["sidoCode"]))
    if case.get("sigunguCode"):
        filters.append(term("ldongSignguCd", case["sigunguCode"]))
    if case.get("category"):
        filters.append({"terms": {"category": case["category"].split(",")}})
    if case.get("lat"):
        filters.append({"geo_distance": {"distance": f'{float(case.get("radiusKm", 5))}km',
                                         "location": {"lat": float(case["lat"]), "lon": float(case["lng"])}}})
    must = [{"multi_match": {"query": case["keyword"], "fields": [
        "title^3", "title.en^3", "titleLocal^3", "overview", "overview.en", "address", "address.en"]}}] \
        if with_text and case.get("keyword") else [{"match_all": {}}]
    return must, filters


def direct_count(case, facet, condition, day, with_text):
    must, filters = structure(case, with_text)
    others = [f for k, f in selections(case, day).items() if k != facet]
    body = {"query": {"bool": {"must": must, "filter": filters + others + [condition]}}}
    return http_json(f"{OS_URL}/{INDEX}/_count", body)["count"]


def main():
    failures = 0
    for case in CASES:
        day = WEEKDAY[datetime.datetime.now(KST).weekday()]
        res = http_json(f"{API_URL}?{urllib.parse.urlencode({**case, 'size': 1, 'facets': 'true'})}")
        facets = (res.get("data") or {}).get("attributeFacets")
        print(f"\n# {case}  (오늘 KST {day})")
        if facets is None:
            print("  FAIL attributeFacets 가 없다(건수 요청 실패 또는 옛 이미지)")
            failures += 1
            continue
        has_text = bool(case.get("keyword"))
        for path, facet, condition in buckets(day):
            api = facets
            for key in path:
                api = api[key]
            structural = direct_count(case, facet, condition, day, with_text=False)
            textual = direct_count(case, facet, condition, day, with_text=True) if has_text else structural
            if api == textual:
                verdict = "OK" + (" (질의어 반영 — 텍스트 경로)" if has_text else "")
            elif api == structural:
                verdict = "OK (질의어 제외 — 하이브리드/벡터 경로)"
            else:
                verdict = "FAIL"
                failures += 1
            detail = f"_count={textual}" if not has_text else f"_count 텍스트={textual} 구조={structural}"
            print(f"  {verdict:<34} {'.'.join(path):<22} api={api:<7} {detail}")
    print(f"\n{'전부 일치' if failures == 0 else f'불일치 {failures}건'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
