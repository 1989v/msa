"""연관 관광지 — 출발·대상 이름 매칭 실측 · 원문 보존 · 시군구별 수집 · 전달 자료 공개 전 재시도 · 단위별 실패 격리."""
from __future__ import annotations

import json
from collections import Counter
from datetime import date
from urllib.parse import parse_qs, urlparse

import pytest

from src import datagokr, name_match, place_client, related
from tests.datagokr_test import LIMIT_XML, Recorder, ok_body
from tests.fixture_rows import load

SAMPLE = load("phase2-related.json")
ROWS = SAMPLE["sourceRows26350"]
SIGUNGU = [r for r in load("phase2-weather.json")["administrativeRegions"] if r["level"] == "SIGUNGU"]
OURS = [{"id": i, "title": t, "lang": "ko", "ldongRegnCd": sg[:2], "ldongSignguCd": sg[2:]}
        for sg, rows in SAMPLE["ours"].items() for i, t in rows]
CANDIDATES = name_match.candidates_by_sigungu(OURS)
#: 2026-10-13 KST — 수집 창(12~28일) 안, 전달은 2026-09
OCT13 = date(2026, 10, 13)


def _query(url: str) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}


def _loose_hit(name: str, sigungu: str) -> bool:
    """설계 §2.2 의 「정규화 일치」 집계 — 정확 또는 정규화가 같은 우리 행이 하나라도 있는가(후보 수는 안 본다)."""
    key = name_match.normalize(name)
    return any(c.title == name or name_match.normalize(c.title) == key for c in CANDIDATES.get(sigungu, []))


def test_measured_three_sigungu_reproduce_the_design_numbers_for_starts_and_targets():
    """종로구·제주시·해운대구 202608 원천 7,869행. 설계 §2.2: 출발 정규화 178/236 · 대상 관광지 448/867 · 음식 270/1,494 · 숙박 121/503.

    설계 수치는 후보 수를 보지 않은 「정확 또는 정규화가 같은 행이 있다」의 수다. 매칭 함수는 같은 단계에 후보가 둘 이상이면
    잇지 않는다 — 그 차이(출발 2 · 대상 관광지 14)가 전부 `AMBIGUOUS` 여야 한다(우리 DB 에 같은 제목 행이 둘인 곳: 부산타워 ×2 등).
    """
    assert sum(SAMPLE["sourceRowCounts"].values()) == 7_869
    starts = [tuple(s) for s in SAMPLE["starts"]]
    assert len(starts) == 236
    start = {s: name_match.match(s[1], CANDIDATES.get(s[0], [])) for s in starts}
    methods = Counter(m.method for m in start.values())
    assert methods["EXACT"] == 134
    assert methods["EXACT"] + methods["NORMALIZED"] == 176
    loose = [s for s in starts if _loose_hit(s[1], s[0])]
    assert len(loose) == 178
    assert {start[s].method for s in loose if start[s].method not in ("EXACT", "NORMALIZED")} == {"AMBIGUOUS"}

    by_lcls: dict[str, list[tuple[str, str]]] = {}
    for sigungu, name, lcls in SAMPLE["targets"]:
        by_lcls.setdefault(lcls, []).append((sigungu, name))
    assert {k: len(v) for k, v in by_lcls.items()} == {"관광지": 867, "음식": 1_494, "숙박": 503}
    served = {k: sum(1 for sg, n in v if name_match.match(n, CANDIDATES.get(sg, [])).method in ("EXACT", "NORMALIZED"))
              for k, v in by_lcls.items()}
    assert served == {"관광지": 434, "음식": 270, "숙박": 121}
    tourist_loose = [t for t in by_lcls["관광지"] if _loose_hit(t[1], t[0])]
    assert len(tourist_loose) == 448
    assert {name_match.match(n, CANDIDATES[sg]).method for sg, n in tourist_loose} - {"EXACT", "NORMALIZED"} == {"AMBIGUOUS"}


def test_record_keeps_every_source_row_verbatim_in_rank_order_and_derives_each_target_match():
    first = ROWS[0]["tAtsCd"]
    rows = [r for r in ROWS if r["tAtsCd"] == first]
    assert len(rows) == 40          # 해운대구 첫 출발 관광지 — 순위 1~40
    targets = [name_match.Match(None, "NONE", ()) for _ in rows]
    targets[0] = name_match.Match(9, "EXACT", (9,))
    rec = related.record(list(reversed(rows)), name_match.Match(7, "NORMALIZED", (7,)), targets)

    by_rank = sorted(rows, key=lambda r: int(r["rlteRank"]))
    assert json.loads(rec["relatedRaw"]) == by_rank
    assert (rec["tAtsCd"], rec["tAtsNm"]) == (first, rows[0]["tAtsNm"])
    # 지역 이름·코드는 원문에만 있다(place 표에 컬럼이 없다) — 원문이 그것을 잃지 않는다
    assert {(r["areaCd"], r["signguNm"]) for r in json.loads(rec["relatedRaw"])} == {("26", "해운대구")}
    assert (rec["attractionId"], rec["matchMethod"]) == (7, "NORMALIZED")
    assert [t["rank"] for t in rec["targets"]] == list(range(1, 41))
    # 대상 매칭은 순위 순으로 줄을 맞춘다 — 원천 행 순서가 섞여 와도 순위 1 의 매칭이 순위 1 대상에 붙는다
    top = rec["targets"][0]
    assert (top["name"], top["lcls"], top["signguCd"]) == (by_rank[0]["rlteTatsNm"], by_rank[0]["rlteCtgryLclsNm"], by_rank[0]["rlteSignguCd"])
    assert (top["attractionId"], top["matchMethod"]) == (9, "EXACT")
    assert {(t["attractionId"], t["matchMethod"]) for t in rec["targets"][1:]} == {(None, "NONE")}


def test_record_refuses_two_starts_a_broken_rank_or_a_repeated_rank():
    a = ROWS[0]
    b = next(r for r in ROWS if r["tAtsCd"] != a["tAtsCd"])
    none = name_match.Match(None, "NONE", ())
    with pytest.raises(ValueError):
        related.record([a, b], none, [none, none])
    with pytest.raises(ValueError):
        related.record([{**a, "rlteRank": "첫째"}], none, [none])
    with pytest.raises(ValueError):
        related.record([a, {**a, "rlteTatsNm": "다른 곳"}], none, [none, none])


def test_records_for_matches_each_start_in_its_sigungu_and_each_target_in_the_target_sigungu():
    records = related.records_for(ROWS, CANDIDATES)
    assert len(records) == 16
    assert sum(len(r["targets"]) for r in records) == 607
    # 설계 §2.2 해운대구 행: 출발 정확 7 · 정규화까지 8
    start = Counter(r["matchMethod"] for r in records)
    assert start["EXACT"] == 7 and start["EXACT"] + start["NORMALIZED"] == 8
    # 대상은 대상 시군구(rlteSignguCd)의 우리 행에 잇는다 — 해운대구 출발이라도 수영구·기장군 대상이 이어진다
    linked = {t["signguCd"] for r in records for t in r["targets"] if t["matchMethod"] == "EXACT"}
    assert "26350" in linked and len(linked) > 1
    for r in records:
        for t in r["targets"]:
            expected = name_match.match(t["name"], CANDIDATES.get(t["signguCd"], []))
            assert (t["attractionId"], t["matchMethod"]) == (expected.attraction_id, expected.method)


def test_previous_month_is_the_target():
    assert related.target_month(date(2026, 10, 12)) == "202609"
    assert related.target_month(date(2027, 1, 12)) == "202612"


def _run(replies, monkeypatch, regions=None, state=None, today=OCT13, base_ym=None):
    pushed: dict[str, tuple[str, list[dict]]] = {}

    def put(sigungu, ym, records):
        pushed[sigungu] = (ym, records)
        return {"applied": len(records), "removed": 0}

    monkeypatch.setattr(place_client, "put_related", put)
    fake = Recorder(replies)
    client = datagokr.Client(key="K", api=related.API, budget=related.DAILY_BUDGET, gap_sec=0, fetch=fake)
    summary = related.run("K", today=today, base_ym=base_ym, client=client, regions=regions or SIGUNGU,
                          attractions=OURS, state=state if state is not None else {})
    return summary, fake, pushed


def _as_month(rows: list[dict], ym: str) -> list[dict]:
    return [{**r, "baseYm": ym} for r in rows]


def test_first_run_asks_every_sigungu_once_for_the_previous_month_and_sends_only_sigungu_with_rows(monkeypatch):
    replies = [(200, ok_body(_as_month(ROWS, "202609"))) if r["code"] == "26350" else (200, ok_body([])) for r in SIGUNGU]
    summary, fake, pushed = _run(replies, monkeypatch)

    assert len(fake.sent) == 269 == summary["calls"]
    q = _query(next(u for u in fake.sent if "signguCd=26350" in u))
    assert (q["baseYm"], q["areaCd"], q["signguCd"], q["numOfRows"]) == ("202609", "26", "26350", "10000")
    assert list(pushed) == ["26350"] and pushed["26350"][0] == "202609"
    assert len(pushed["26350"][1]) == 16
    assert len(summary["empty"]) == 268 and summary["published"] is True and summary["failed"] is False


def test_month_already_received_everywhere_makes_no_call(monkeypatch):
    summary, fake, pushed = _run([], monkeypatch, state={"11110": "202609", "26350": "202609"})
    assert fake.sent == [] and pushed == {}
    assert summary["skipped"] is True and summary["failed"] is False


def test_previous_month_not_public_yet_costs_one_probe_call_and_is_retried_the_next_day(monkeypatch):
    """2026-10-02 실측: 202609 는 0건, 202608 은 있다. 지난달 행이 있던 시군구 하나만 물어 보고 0건이면 그날은 멈춘다."""
    state = {"11110": "202608", "26350": "202608", "50110": "202608"}
    summary, fake, pushed = _run([(200, ok_body([]))], monkeypatch, state=state)
    assert len(fake.sent) == 1 and _query(fake.sent[0])["signguCd"] == "11110"
    assert pushed == {} and summary["published"] is False and summary["failed"] is False

    # 창의 마지막 날까지 안 나오면 실패로 알린다(Job 실패 = 알림)
    last, _, _ = _run([(200, ok_body([]))], monkeypatch, state=state, today=date(2026, 10, related.LAST_DAY))
    assert last["published"] is False and last["failed"] is True


def test_retry_asks_only_sigungu_still_on_the_old_month(monkeypatch):
    """어제 한도·실패로 덜 받은 날 — 이미 이번 달을 받은 시군구는 다시 묻지 않는다."""
    regions = [r for r in SIGUNGU if r["code"] in ("11110", "26350", "50110")]
    state = {"11110": "202609", "26350": "202608", "50110": "202609"}
    summary, fake, pushed = _run([(200, ok_body(_as_month(ROWS, "202609")))], monkeypatch, regions=regions, state=state)
    assert [_query(u)["signguCd"] for u in fake.sent] == ["26350"]
    assert list(pushed) == ["26350"] and summary["failed"] is False


def test_one_failed_sigungu_does_not_stop_the_rest_and_rows_of_another_month_are_refused(monkeypatch):
    regions = [r for r in SIGUNGU if r["code"] in ("11110", "26350", "50110")]
    replies = [(500, "oops"), (200, ok_body(_as_month(ROWS, "202609"))), (200, ok_body(_as_month(ROWS[:3], "202608")))]
    summary, _, pushed = _run(replies, monkeypatch, regions=regions)
    assert list(pushed) == ["26350"]
    assert summary["failedUnits"] == ["11110", "50110"] and summary["failed"] is True


def test_quota_stop_keeps_what_was_received_and_is_not_a_failure(monkeypatch):
    regions = [r for r in SIGUNGU if r["code"] in ("11110", "26350", "50110")]
    summary, fake, pushed = _run([(200, ok_body([])), (200, ok_body(_as_month(ROWS, "202609"))), (200, LIMIT_XML)],
                                 monkeypatch, regions=regions)
    assert len(fake.sent) == 3 and list(pushed) == ["26350"]
    assert summary["stopped"] and summary["failed"] is False


def test_manual_month_overrides_the_previous_month(monkeypatch):
    regions = [r for r in SIGUNGU if r["code"] == "26350"]
    summary, fake, pushed = _run([(200, ok_body(ROWS))], monkeypatch, regions=regions, base_ym="202608")
    assert _query(fake.sent[0])["baseYm"] == "202608" and pushed["26350"][0] == "202608"
    assert summary["baseYm"] == "202608" and summary["failed"] is False
