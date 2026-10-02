"""웰니스 — 원문 보존 · 언어별 통째 교체 · 받지 못한 언어는 그대로."""
from __future__ import annotations

import json

from src import datagokr, place_client, wellness
from tests.datagokr_test import Recorder, ok_body
from tests.fixture_rows import load

ROWS = load("phase2-barrier-free-wellness.json")["wellnessRows"]


def test_record_keeps_all_19_source_keys_and_lifts_theme_code():
    rec = wellness.record(ROWS[0])
    assert rec["contentId"] == "2994116" and rec["themaCd"] == "EX050100"
    assert json.loads(rec["listRaw"]) == ROWS[0]
    assert len(ROWS[0]) == 19


def test_each_language_is_replaced_whole_and_a_failed_language_is_left_alone(monkeypatch):
    pushed: dict[str, list[dict]] = {}
    monkeypatch.setattr(place_client, "put_wellness",
                        lambda lang, items: pushed.setdefault(lang, items) and {"matched": len(items), "unmatched": 0, "removed": 0})
    fake = Recorder([(200, ok_body(ROWS, total=len(ROWS))), (500, "upstream")])
    summary = wellness.run("K", client=datagokr.Client(key="K", api=wellness.API, budget=wellness.WEEKLY_BUDGET,
                                                         gap_sec=0, fetch=fake))
    assert list(pushed) == ["ko"]
    assert [i["contentId"] for i in pushed["ko"]] == ["2994116", "127956"]
    assert summary["failed"] is True
    assert "langDivCd=KOR" in fake.sent[0] and "langDivCd=ENG" in fake.sent[1]


def test_zero_rows_do_not_wipe_the_tags(monkeypatch):
    called = []
    monkeypatch.setattr(place_client, "put_wellness", lambda lang, items: called.append(lang))
    fake = Recorder([(200, ok_body([], total=0)), (200, ok_body([], total=0))])
    summary = wellness.run("K", client=datagokr.Client(key="K", api=wellness.API, budget=4, gap_sec=0, fetch=fake))
    assert called == [] and summary["failed"] is True


def test_medical_tourism_themes_are_not_loaded_and_other_themes_remain(monkeypatch, capsys):
    """의료관광(EX0508xx)은 싣지 않는다. 표본에 그 코드 행이 없어 실측 행의 테마 코드만 EX050800 으로 바꾼 사본을 쓴다."""
    medical = {**ROWS[1], "wellnessThemaCd": "EX050800"}
    pushed: dict[str, list[dict]] = {}
    monkeypatch.setattr(place_client, "put_wellness",
                        lambda lang, items: pushed.setdefault(lang, items) and {"matched": len(items), "unmatched": 0, "removed": 0})
    fake = Recorder([(200, ok_body([ROWS[0], medical], total=2)), (200, ok_body([medical], total=1))])
    summary = wellness.run("K", client=datagokr.Client(key="K", api=wellness.API, budget=4, gap_sec=0, fetch=fake))

    assert [i["contentId"] for i in pushed["ko"]] == ["2994116"]
    assert all(not i["themaCd"].startswith("EX0508") for items in pushed.values() for i in items)
    # 의료관광만 온 언어는 빈 교체를 보내지 않는다(이전 태그 유지)
    assert "en" not in pushed and summary["failed"] is True
    assert "의료관광 제외 1건" in capsys.readouterr().out
