#!/usr/bin/env python3
"""관광지 검색 회귀 체크 — 실측으로 잡은 품질 문제가 되돌아오지 않는지 라이브에 묻는다.

    python3 scripts/attractions-search-check.py                # 운영(api.1989v.com)
    SEARCH_API=http://localhost:8083 python3 scripts/...       # 로컬

각 케이스는 docs/plans/2026-08-19-k-tour-search-handoff.md §4 의 **측정된 문제**에서 왔다.
케이스를 지우려면 그 문제가 왜 더는 문제가 아닌지부터 핸드오프에 적을 것.

랭킹을 손댔으면 배포 후 이걸 돌린다 — 전/후 비교 없이는 좋아졌는지 말할 수 없다.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request

BASE = os.environ.get("SEARCH_API", "https://api.1989v.com")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0 Safari/537.36")


def get(path: str, **params) -> dict | list:
    url = f"{BASE}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())["data"]


def suggest(q: str) -> list[dict]:
    return get("/api/search/attractions/suggest", q=q, lang="ko", size=8)


def search(keyword: str, size: int = 5) -> list[dict]:
    return get("/api/search/attractions", keyword=keyword, lang="ko", size=size)["attractions"]


CHECKS = []


def check(name):
    def deco(fn):
        CHECKS.append((name, fn))
        return fn
    return deco


@check("'경복' 자동완성 1위가 경복궁 (이름 접두 부스트)")
def _():
    hits = suggest("경복")
    assert hits, "결과 없음"
    top = hits[0]["title"]
    assert top == "경복궁", f"1위가 '{top}' — 상호에 지명이 들어간 상점이 본체를 밀어냈다"


@check("'경보'(조합 중간)로도 경복궁이 나온다 (자모)")
def _():
    titles = [h["title"] for h in suggest("경보")]
    assert "경복궁" in titles, f"자모 매칭 실패: {titles[:5]}"


@check("'한옥' 상위 4개에 음식점이 없다 (분류 가중치)")
def _():
    cats = [(a["title"], a.get("category")) for a in search("한옥", 4)]
    foods = [t for t, c in cats if c == "food"]
    assert not foods, f"식당이 다시 올라왔다: {foods}"


@check("'궁궐'에 경복궁이 나온다 (유사어)")
def _():
    titles = [a["title"] for a in search("궁궐", 10)]
    assert any("경복궁" in t for t in titles), f"유사어 확장 실패: {titles[:6]}"


@check("'해수욕장' 상위가 전부 nature (기존 정상 동작 보존)")
def _():
    cats = {a.get("category") for a in search("해수욕장", 5)}
    assert cats == {"nature"}, f"nature 가 아닌 분류 섞임: {cats}"


@check("'해운' 자동완성 상단에 지역 슬롯 (해운대구)")
def _():
    hits = suggest("해운")
    assert hits and hits[0]["type"] == "REGION", f"상단이 지역이 아니다: {hits[0] if hits else '없음'}"


def main() -> int:
    failed = 0
    for name, fn in CHECKS:
        try:
            fn()
            print(f"  ✓ {name}")
        except AssertionError as e:
            failed += 1
            print(f"  ✗ {name} — {e}")
        except Exception as e:  # 네트워크 등 — 판정 불가는 실패와 구분해 보인다
            failed += 1
            print(f"  ? {name} — 측정 불가: {e}")
    print(f"\n{len(CHECKS) - failed}/{len(CHECKS)} 통과 ({BASE})")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
