"""웰니스관광 수집 — 한국관광공사 `WellnessTursmService` (data.go.kr 15144030).

국문 170 중 168, 영문 92 전부가 기존 TourAPI contentId 다(2026-10-02 실측). 새 관광지가 아니라 기존 행의
테마 태그라 별도 표(`attraction_wellness`)에 싣는다. 목록 한 콜(`numOfRows=500`)에 언어 하나가 전량이라
언어마다 **받은 목록으로 통째로 바꾼다** — 원천에서 빠진 곳은 태그도 빠진다. 받지 못한 언어는 건드리지 않는다.

주 1회(월요일 KST)만 부른다 — 하루 2콜.
"""
from __future__ import annotations

import json

from src import datagokr, place_client

API = "WellnessTursmService"
PATH = f"B551011/{API}"
PAGE_ROWS = 500
#: 언어 둘 × 한 쪽. 원천이 500 을 넘으면 다음 쪽을 받되 이 상한 안에서만.
WEEKLY_BUDGET = 4
LANGS = {"KOR": "ko", "ENG": "en"}
_COMMON = {"MobileOS": "ETC", "MobileApp": "msa-seed", "_type": "json"}

#: 의료관광 계열 테마(`EX0508xx`, 「기타의료관광」) — 적재·노출하지 않는다. 규제 업권(의료)을 노출 대상으로 두지 않는다
#: (의료법 27조). 관광지 분류에서도 같은 코드를 관광지가 아닌 것으로 뺀다(`sync_tour.NON_TOURISM_LCLS3`).
MEDICAL_THEME_PREFIX = "EX0508"


def is_medical(row: dict) -> bool:
    return str(row.get("wellnessThemaCd") or "").strip().startswith(MEDICAL_THEME_PREFIX)


def log(msg: str) -> None:
    print(f"[wellness] {msg}", flush=True)


def record(row: dict) -> dict:
    """목록 행 → place 적재 항목. 테마 코드(`wellnessThemaCd`, EX05xxxx)만 파생 컬럼으로 펴고 원문을 통째로 싣는다."""
    return {
        "contentId": str(row["contentId"]).strip(),
        "themaCd": str(row.get("wellnessThemaCd") or "").strip(),
        "listRaw": json.dumps(row, ensure_ascii=False, separators=(",", ":")),
    }


def fetch(client: datagokr.Client, lang_div: str) -> list[dict]:
    rows: list[dict] = []
    page = 1
    while True:
        body = client.get(f"{PATH}/areaBasedList",
                          {**_COMMON, "numOfRows": PAGE_ROWS, "pageNo": page, "langDivCd": lang_div},
                          f"웰니스 {lang_div}")
        got = datagokr.items(body)
        rows.extend(got)
        if not got or page * PAGE_ROWS >= int(body.get("totalCount") or 0):
            return rows
        page += 1


def run(key: str, client: datagokr.Client | None = None) -> dict:
    client = client or datagokr.Client(key=key, api=API, budget=WEEKLY_BUDGET)
    summary = {"api": API, "calls": 0, "failed": False, "langs": {}}
    for lang_div, lang in LANGS.items():
        try:
            rows = fetch(client, lang_div)
        except Exception as e:                              # noqa: BLE001 — 언어별 격리, 받지 못한 언어는 이전 값 유지
            log(f"[{lang}] 실패 — 이전 태그를 그대로 둔다: {e}")
            summary["failed"] = True
            continue
        if not rows:
            # 0건은 「원천에서 다 빠졌다」보다 「원천이 잠깐 빈 답을 줬다」일 가능성이 크다 — 통째로 지우지 않는다
            log(f"[{lang}] 원천 0건 — 이전 태그를 그대로 둔다")
            summary["failed"] = True
            continue
        medical = sum(1 for r in rows if is_medical(r))
        log(f"[{lang}] 의료관광 제외 {medical}건")
        # 의료관광 행은 보내지 않는다 — 통째 교체라 이미 적재된 의료관광 태그도 이번 회차에 빠진다
        items = [record(r) for r in rows
                 if not is_medical(r) and str(r.get("contentId") or "").strip() and str(r.get("wellnessThemaCd") or "").strip()]
        if not items:
            # 원천은 답했지만 남는 행이 없다 — place 는 빈 교체를 받지 않으므로 이전 태그를 그대로 둔다
            log(f"[{lang}] 의료관광을 빼면 0건 — 이전 태그를 그대로 둔다")
            summary["failed"] = True
            continue
        applied = place_client.put_wellness(lang, items)
        summary["langs"][lang] = applied
        log(f"[{lang}] 원천 {len(rows)} · 관광지에 붙음 {applied.get('matched')} · 못 붙음 {applied.get('unmatched')} · "
            f"빠진 태그 {applied.get('removed')}")
    summary["calls"] = client.calls
    log(f"API {API} · 호출 {client.calls}")
    return summary
