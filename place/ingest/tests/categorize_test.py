"""파생 분류 — 유형 코드가 먼저 정한다(행사·숙박·코스), 그 밖의 유형은 예전 결과 그대로."""
from __future__ import annotations

from src.sync_tour import has_coordinates, normalize_row
from tests.fixture_rows import all_rows, load, rows

NEW_TYPE_CATEGORY = {"15": "festival", "85": "festival", "32": "stay", "80": "stay", "25": "course"}


def _category(item: dict, lang: str) -> str:
    return normalize_row(item, lang)["category"]


def test_new_types_are_categorized_by_content_type():
    cases = [
        ("sample-searchFestival2-ko.json", "itemsWindowToday", "ko", "festival"),
        ("sample-searchFestival2-en.json", "itemsWindowToday", "en", "festival"),
        ("sample-searchStay2-ko.json", "items", "ko", "stay"),
        ("sample-searchStay2-en.json", "items", "en", "stay"),   # 신분류 VE 인 80 행도 stay
        ("sample-course-ko.json", "items", "ko", "course"),
    ]
    for name, key, lang, expected in cases:
        got = {_category(it, lang) for it in rows(name, key)}
        assert got == {expected}, (name, got)


def test_festival_ev_is_not_folded_into_culture():
    items = rows("sample-searchFestival2-ko.json", "itemsWindowToday")
    assert {it["lclsSystm1"] for it in items} == {"EV"}
    assert all(_category(it, "ko") != "culture" for it in items)


def test_other_types_keep_previous_result_for_every_sample_row():
    """옛 정규화(분리 전 fetch_area_based)가 표본 전량에 낸 분류와 같다 — 새 유형만 바뀐다."""
    before = load("sync_area_based_before.json")
    for service, lang in (("KorService2", "ko"), ("EngService2", "en")):
        expected = {r["contentId"]: r["category"] for r in before[lang]["rows"]}
        items = [it for it in all_rows(service) if has_coordinates(it)]
        assert len(items) == len(before[lang]["rows"])
        for it in items:
            type_id = it["contenttypeid"]
            want = NEW_TYPE_CATEGORY.get(type_id, expected[str(it["contentid"])])
            assert _category(it, lang) == want, (lang, it["contentid"], type_id)


def test_leisure_camping_with_ac_stays_stay():
    camp = [it for it in rows("sample-searchStay2-ko.json", "itemsNotType32") if it["contenttypeid"] == "28"]
    assert camp and camp[0]["lclsSystm1"] == "AC"
    assert _category(camp[0], "ko") == "stay"
