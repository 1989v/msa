"""무장애 — 플래그 파생 규칙 · 상세 대상 선택 · 원문 보존. 표본은 운영 응답 100건(fixtures/phase2-barrier-free-wellness.json)."""
from __future__ import annotations

import json

from src import barrier_free
from src.barrier_free import derive_flags, detail_record, list_record, pick_details
from tests.fixture_rows import load

SAMPLE = load("phase2-barrier-free-wellness.json")
DETAILS = SAMPLE["details"]


def _detail_with(key: str, value: str) -> dict:
    return next(d for d in DETAILS if d.get(key) == value)


def test_gyeongbokgung_detail_yields_only_positive_codes_in_source_order():
    """sample-phase2-apis.json 「1 무장애 상세」(경복궁 126508) — 값이 있는 키만 코드가 된다."""
    item = SAMPLE["detailGyeongbokgung"]
    assert item["contentid"] == "126508"
    assert derive_flags(item) == ["PARKING", "WHEELCHAIR", "EXIT", "RESTROOM", "AUDIO_GUIDE",
                                  "STROLLER", "LACTATION_ROOM", "INFANT_ETC"]


def test_negative_sentences_from_the_sample_are_not_flags():
    no_parking = _detail_with("parking", "장애인 주차장 없음")
    assert "PARKING" not in derive_flags(no_parking)
    # 「없음」만 보면 「있음」이 되던 줄 — 「없으」를 부정어로 둔 이유
    no_elevator = _detail_with("elevator", "엘리베이터는 없으나 장애인 전용 숙소 1층임")
    assert "ELEVATOR" not in derive_flags(no_elevator)
    # 대조군: 같은 키의 긍정 문장은 코드가 된다
    assert "ELEVATOR" in derive_flags(_detail_with("elevator", "엘리베이터 있음"))
    assert "PARKING" in derive_flags(_detail_with("parking", "장애인 주차장 있음_무장애 편의시설"))


def test_every_sample_flag_comes_from_a_non_empty_source_value():
    codes = set(barrier_free.DETAIL_KEYS.values())
    by_code = {code: key for key, code in barrier_free.DETAIL_KEYS.items()}
    total = 0
    for item in DETAILS:
        flags = derive_flags(item)
        assert set(flags) <= codes
        assert all(str(item.get(by_code[c]) or "").strip() for c in flags)
        total += len(flags)
    assert total > 0
    # 원천 상세 키 29개 = contentid + 파생 표의 28키 — 원천이 키를 바꾸면 여기서 드러난다
    assert set(DETAILS[0]) == {"contentid", *barrier_free.DETAIL_KEYS}


def test_pick_unsynced_first_then_list_modified_after_last_detail():
    state = [
        {"contentId": "300", "listModifiedAt": "2026-10-01T00:00:00", "detailSyncedAt": "2026-09-20T02:40:00"},  # 바뀜
        {"contentId": "126508", "listModifiedAt": "2026-08-01T00:00:00", "detailSyncedAt": None},               # 미수집
        {"contentId": "99", "listModifiedAt": None, "detailSyncedAt": None},                                     # 미수집
        {"contentId": "400", "listModifiedAt": "2026-09-01T00:00:00", "detailSyncedAt": "2026-09-20T02:40:00"},  # 그대로
        {"contentId": "500", "listModifiedAt": "2026-09-25T00:00:00", "detailSyncedAt": "2026-09-20T02:40:00"},  # 바뀜
    ]
    assert pick_details(state, 10) == ["99", "126508", "300", "500"]
    assert pick_details(state, 3) == ["99", "126508", "300"]
    assert pick_details(state, 0) == []


def test_list_record_keeps_every_source_key_and_parses_modified_time():
    row = SAMPLE["listRows"][0]
    rec = list_record(row)
    assert json.loads(rec["listRaw"]) == row
    assert rec["contentId"] == row["contentid"]
    m = row["modifiedtime"]
    assert rec["listModifiedAt"] == f"{m[0:4]}-{m[4:6]}-{m[6:8]}T{m[8:10]}:{m[10:12]}:{m[12:14]}"


def test_detail_record_marks_empty_responses_as_received():
    rec = detail_record("126508", None, synced_at="2026-10-03T02:41:00")
    assert rec == {"contentId": "126508", "detailRaw": None, "flags": [],
                   "flagsRuleVer": barrier_free.FLAG_RULE_VERSION, "detailSyncedAt": "2026-10-03T02:41:00"}
    full = detail_record(DETAILS[0]["contentid"], DETAILS[0])
    assert json.loads(full["detailRaw"]) == DETAILS[0]
