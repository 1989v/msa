"""보강 우선순위 — 종료 안 된 행사가 맨 앞(시작일 오름차순), 코스는 반복정보에서 관광 분류와 같은 순위."""
from __future__ import annotations

from datetime import date

from src import backfill_intro, backfill_media, backfill_overview
from src.sync_tour import normalize_row, parse_event_date
from tests.fixture_rows import rows

# 이날 기준 표본 행사 국문 6건 중 10-01~10-05 두 건은 끝났고 나머지 넷은 진행 중이거나 예정이다.
TODAY = date(2026, 10, 6)


def _attraction_rows(name: str, key: str, lang: str) -> list[dict]:
    """place 목록 응답 모양 — 날짜는 서버가 내는 ISO 문자열."""
    out = []
    for it in rows(name, key):
        rec = normalize_row(it, lang)
        if "eventstartdate" in it:
            rec["eventStartDate"] = parse_event_date(it["eventstartdate"])
            rec["eventEndDate"] = parse_event_date(it["eventenddate"])
        out.append(rec)
    return out


def _sample() -> list[dict]:
    sights = _attraction_rows("sample-searchStay2-ko.json", "itemsNotType32", "ko")   # 관광지 12 · 레포츠 28
    festivals = (_attraction_rows("sample-searchFestival2-ko.json", "itemsWindowToday", "ko")
                 + _attraction_rows("sample-searchFestival2-ko.json", "itemsWindowMinus365OngoingStartedBeforeToday", "ko"))
    return sights + festivals


def _expect_festivals_first(picked: list[dict]) -> None:
    live = [r for r in picked[:4]]
    assert all(r["category"] == "festival" for r in live)
    assert [r["eventStartDate"] for r in live] == ["2026-03-14", "2026-10-17", "2026-10-19", "2026-11-07"]
    ended = [r for r in picked if r["category"] == "festival" and r["eventEndDate"] < TODAY.isoformat()]
    assert len(ended) == 2
    # 끝난 행사는 관광 분류보다도 뒤다
    first_ended = min(picked.index(r) for r in ended)
    assert all(picked.index(r) < first_ended for r in picked if r["category"] in backfill_overview.SIGHT_CATEGORIES)


def test_overview_pick_puts_live_festivals_first_by_start_date():
    picked = backfill_overview.pick(_sample(), "ko", 100, set(), TODAY)
    assert len(picked) == 11
    _expect_festivals_first(picked)


def test_intro_pick_puts_live_festivals_first_by_start_date():
    picked = backfill_intro.pick(_sample(), "ko", 100, TODAY)
    _expect_festivals_first(picked)


def test_media_pick_ranks_course_with_sight_categories():
    stays = _attraction_rows("sample-searchStay2-ko.json", "items", "ko")        # 사진 있음, 관광 분류 아님
    courses = _attraction_rows("sample-course-ko.json", "items", "ko")           # 사진 없음
    sights = _attraction_rows("sample-searchStay2-ko.json", "itemsNotType32", "ko")
    picked = backfill_media.pick(stays + courses + sights, "ko", 100)
    head = picked[:len(courses) + len(sights)]
    assert {r["contentId"] for r in courses} <= {r["contentId"] for r in head}
    assert all(r["category"] == "stay" and r["contentTypeId"] == "32" for r in picked[len(head):])


def test_backfill_jobs_pick_tourapi_rows_only():
    # 고캠핑 행은 자기 번호 체계다 — 그 번호로 detailCommon2 를 부르면 엉뚱한 TourAPI 콘텐츠의 개요가 붙는다(Q-P2-KEY)
    base = _sample()
    camp = [dict(r, source="GOCAMPING") for r in base]
    old = [{k: v for k, v in r.items() if k != "source"} for r in base]   # source 가 없던 옛 응답 = TourAPI
    for picked in (
        backfill_intro.pick(camp + old, "ko", 10_000, today=TODAY),
        backfill_media.pick(camp + old, "ko", 10_000),
        backfill_overview.pick(camp + old, "ko", 10_000, set(), today=TODAY),
    ):
        assert picked and all("source" not in r for r in picked)
