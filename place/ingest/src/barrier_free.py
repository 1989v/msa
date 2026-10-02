"""무장애 여행 정보 수집 — 한국관광공사 `KorWithService2` (data.go.kr 15101897).

목록 `areaBasedList2` 는 한 콜(`numOfRows=10000`)에 전량(2026-10-02 실측 9,630)이 오고, 그 contentid 가
국문 TourAPI contentId 와 같다(9,623 일치). 그래서 새 관광지 행이 아니라 기존 행에 붙는 별도 표
(`attraction_barrier_free`)에 싣는다 — 관광지 bulk upsert(전체 동기화) 경로를 타지 않는다.

상세 `detailWithTour2` 는 관광지당 1콜이고 값은 자유 문장(「대여가능」「장애인 화장실 있음」)이다.
하루 예산(목록 1 + 상세 899)만큼 잘라 받는다 — 아직 상세를 안 받은 곳부터, 그다음 목록 수정 시각이
마지막 상세 수집보다 뒤인 곳.

원문은 목록 행·상세 응답을 통째로 남기고(§0 ①), 화면·필터가 쓰는 긍정 코드 목록만 파생한다(§0 ②).
"""
from __future__ import annotations

import json
from datetime import datetime

from src import datagokr, place_client
from src.sync_tour import parse_modified

API = "KorWithService2"
PATH = f"B551011/{API}"
LIST_ROWS = 10000
#: 하루 호출 상한 — 목록 1 + 상세 899. 원천 한도(오퍼레이션당 1,000)에 여유 100 을 둔다.
DAILY_BUDGET = 900
#: 상세를 이만큼 받을 때마다 place 에 적재한다. 기한에 잘려도 거기까지는 남는다.
FLUSH_EVERY = 100
_COMMON = {"MobileOS": "ETC", "MobileApp": "msa-seed", "_type": "json"}

#: 파생 규칙의 판. 아래 표나 [is_positive] 를 바꾸면 올린다 — 옛 판으로 남은 행을 찾아 다시 만든다.
FLAG_RULE_VERSION = 1

#: 상세 원천 키 → 파생 코드. 순서가 화면·서버 렌더의 줄 순서다(원천 응답 순서와 같다).
DETAIL_KEYS: dict[str, str] = {
    "parking": "PARKING",
    "publictransport": "PUBLIC_TRANSPORT",
    "route": "ROUTE",
    "ticketoffice": "TICKET_OFFICE",
    "promotion": "PROMOTION",
    "wheelchair": "WHEELCHAIR",
    "exit": "EXIT",
    "elevator": "ELEVATOR",
    "restroom": "RESTROOM",
    "auditorium": "AUDITORIUM",
    "room": "ROOM",
    "handicapetc": "HANDICAP_ETC",
    "braileblock": "BRAILLE_BLOCK",
    "helpdog": "HELP_DOG",
    "guidehuman": "GUIDE_HUMAN",
    "audioguide": "AUDIO_GUIDE",
    "bigprint": "BIG_PRINT",
    "brailepromotion": "BRAILLE_PROMOTION",
    "guidesystem": "GUIDE_SYSTEM",
    "blindhandicapetc": "BLIND_ETC",
    "signguide": "SIGN_GUIDE",
    "videoguide": "VIDEO_GUIDE",
    "hearingroom": "HEARING_ROOM",
    "hearinghandicapetc": "HEARING_ETC",
    "stroller": "STROLLER",
    "lactationroom": "LACTATION_ROOM",
    "babysparechair": "BABY_CHAIR",
    "infantsfamilyetc": "INFANT_ETC",
}

#: 이 말이 들어간 값은 「없음」으로 본다. 「없으」는 「엘리베이터는 없으나 …」를 잡는다
#: (100건 표본에서 「없음」 규칙만으로는 그 한 줄이 「있음」이 됐다 — implementation/phase2-barrierfree-labels.md).
NEGATIVE_WORDS = ("없음", "없으", "불가", "미설치")


def log(msg: str) -> None:
    print(f"[barrier-free] {msg}", flush=True)


def is_positive(value) -> bool:
    """빈 값이면 없음, 부정어가 들어가면 없음, 그 밖은 있음."""
    text = str(value or "").strip()
    if not text:
        return False
    return not any(word in text for word in NEGATIVE_WORDS)


def derive_flags(item: dict | None) -> list[str]:
    """상세 원문 → 긍정 코드만, [DETAIL_KEYS] 순서. 「없음」·「모름」은 코드가 없다(둘을 가르지 않는다)."""
    if not item:
        return []
    return [code for key, code in DETAIL_KEYS.items() if is_positive(item.get(key))]


def _raw(item: dict) -> str:
    return json.dumps(item, ensure_ascii=False, separators=(",", ":"))


def list_record(row: dict) -> dict:
    """목록 행 → place 적재 항목. 행 원문을 통째로 싣는다."""
    return {
        "contentId": str(row["contentid"]).strip(),
        "listRaw": _raw(row),
        "listModifiedAt": parse_modified(str(row.get("modifiedtime") or "")),
    }


def detail_record(content_id: str, item: dict | None, synced_at: str | None = None) -> dict:
    """상세 응답 → place 적재 항목. 원천이 빈 응답을 줘도 **받았다는 사실**은 남긴다 — 안 남기면 매일 다시 부른다."""
    return {
        "contentId": content_id,
        "detailRaw": _raw(item) if item else None,
        "flags": derive_flags(item),
        "flagsRuleVer": FLAG_RULE_VERSION,
        "detailSyncedAt": synced_at or datetime.now().replace(microsecond=0).isoformat(),
    }


def _at(value) -> datetime:
    """place 가 내는 ISO 시각(초 단위). 문자열 비교에 기대지 않는다 — 초가 0 이면 표기가 짧아지는 직렬화가 있다."""
    return datetime.fromisoformat(str(value))


def pick_details(state: list[dict], budget: int) -> list[str]:
    """상세를 받을 contentId — 아직 안 받은 곳(contentId 순)이 먼저, 그다음 목록 수정 시각이 마지막 상세보다 뒤인 곳.

    값이 아니라 **받은 시각**으로 판정한다 — 원천이 빈 상세를 준 곳을 값으로 재면 매일 같은 곳을 다시 부른다.
    """
    if budget <= 0:
        return []
    never = [s for s in state if not s.get("detailSyncedAt")]
    changed = [s for s in state
               if s.get("detailSyncedAt") and s.get("listModifiedAt")
               and _at(s["listModifiedAt"]) > _at(s["detailSyncedAt"])]
    never.sort(key=lambda s: (len(str(s["contentId"])), str(s["contentId"])))
    changed.sort(key=lambda s: _at(s["listModifiedAt"]), reverse=True)
    return [str(s["contentId"]) for s in never + changed][:budget]


def fetch_list(client: datagokr.Client) -> tuple[list[dict], int]:
    """목록 전량. (행, 전체 건수). 한 콜에 다 오지만 원천이 늘어나면 다음 쪽을 이어 받는다."""
    rows: list[dict] = []
    page = 1
    while True:
        body = client.get(f"{PATH}/areaBasedList2", {**_COMMON, "numOfRows": LIST_ROWS, "pageNo": page}, "무장애 목록")
        got = datagokr.items(body)
        rows.extend(got)
        total = int(body.get("totalCount") or 0)
        if not got or page * LIST_ROWS >= total:
            return rows, total
        page += 1


def fetch_detail(client: datagokr.Client, content_id: str) -> dict | None:
    body = client.get(f"{PATH}/detailWithTour2", {**_COMMON, "contentId": content_id}, "무장애 상세")
    got = datagokr.items(body)
    return got[0] if got else None


def run(key: str, budget: int = DAILY_BUDGET, client: datagokr.Client | None = None) -> dict:
    """목록 → place 적재 → 상세 하루치 → place 적재. 집계를 돌려준다(`failed` 가 참이면 잡이 1 로 끝난다)."""
    client = client or datagokr.Client(key=key, api=API, budget=budget)
    summary = {"api": API, "calls": 0, "list": 0, "matched": 0, "unmatched": 0, "details": 0,
               "detailFailures": 0, "stopped": None, "failed": False}
    try:
        rows, total = fetch_list(client)
    except Exception as e:                                  # noqa: BLE001 — 목록이 없어도 상세 백필은 이어 간다
        log(f"목록 실패 — 상세는 지난 목록 기준으로 이어 받는다: {e}")
        summary["failed"] = True
        rows, total = [], 0
    records = [list_record(r) for r in rows if str(r.get("contentid") or "").strip()]
    summary["list"] = len(records)
    if records:
        applied = place_client.put_barrier_free_list(records)
        summary["matched"] = int(applied.get("matched") or 0)
        summary["unmatched"] = int(applied.get("unmatched") or 0)
        log(f"목록 {len(records):,}/{total:,} · 관광지에 붙음 {summary['matched']:,} · 못 붙음 {summary['unmatched']:,} "
            f"(예: {', '.join(applied.get('unmatchedSample') or []) or '없음'})")

    targets = pick_details(place_client.fetch_barrier_free_state(), client.budget - client.calls)
    log(f"상세 대상 {len(targets):,}건 (남은 예산 {client.budget - client.calls})")
    for start in range(0, len(targets), FLUSH_EVERY):
        chunk = targets[start:start + FLUSH_EVERY]
        result = datagokr.run_units(chunk, lambda cid: detail_record(cid, fetch_detail(client, cid)), log)
        if result.results:
            place_client.put_barrier_free_details(list(result.results.values()))
        summary["details"] += len(result.results)
        summary["detailFailures"] += len(result.failed)
        if result.stopped:
            summary["stopped"] = result.stopped
            break
    summary["calls"] = client.calls
    log(f"API {API} · 호출 {client.calls} · 목록 {summary['list']:,} · 상세 적재 {summary['details']:,} · "
        f"상세 실패 {summary['detailFailures']} · 멈춤 {summary['stopped'] or '없음'}")
    return summary
