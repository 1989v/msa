#!/usr/bin/env python3
"""통합 검색 라이브 검사 — 타입별 대표 질의가 기대한 묶음을 내는지 (플랜 §2 S4 U6).

기대값은 손으로 든 것이고, 근거는 **서비스가 실제로 내놓은 응답**이다 — 검사가 스스로 만든 근거가 아니다.
    python3 scripts/unified-search-check.py [--base https://1989v.com]
"""
import argparse, json, sys, urllib.parse, urllib.request

# (질의, 기대 — 첫 묶음 타입 | 'type:<t>' 는 이해된 타입 | 'has:<t>' 는 그 묶음이 있기만 하면 됨)
CASES = [
    ("경복궁", "attraction"),
    ("관광지 야경", "type:attraction"),
    ("하이브리드 검색", "has:blog_post"),
    ("블로그 하이브리드", "type:blog_post"),
    ("쿼리 언더스탠딩", "has:blog_post"),
    ("AMP ARENA", "has:game"),
    ("게임", "type:game"),
    ("saga pattern", "has:concept"),
    ("개념 캐싱", "type:concept"),
    ("신라면", "has:product"),
    ("여기어때", "has:deal_offer"),
    ("혜택 여행", "type:deal_offer"),
    ("한국 관광 검색", "has:service"),
]

UA = "Mozilla/5.0 msa-unified-check"


def fetch(base, q):
    url = f"{base}/api/search/unified?" + urllib.parse.urlencode({"q": q, "size": 5})
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["data"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://1989v.com")
    args = ap.parse_args()
    failed = 0
    for q, expect in CASES:
        try:
            d = fetch(args.base, q)
        except Exception as e:  # noqa: BLE001
            print(f"  FAIL  {q!r}: 호출 실패 {e}")
            failed += 1
            continue
        groups = [g["type"] for g in d["groups"]]
        understood = d["understood"]["type"]
        if expect.startswith("type:"):
            ok = understood == expect[5:] and groups[:1] == [expect[5:]]
        elif expect.startswith("has:"):
            ok = expect[4:] in groups
        else:
            ok = groups[:1] == [expect]
        first = (d["groups"][0]["hits"][0]["title"] if d["groups"] and d["groups"][0]["hits"] else "-")
        print(f"  {'ok  ' if ok else 'FAIL'}  {q!r:<18} understood={understood} groups={groups} first={first!r}")
        failed += 0 if ok else 1
    print(f"\n{len(CASES) - failed}/{len(CASES)} 통과")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
