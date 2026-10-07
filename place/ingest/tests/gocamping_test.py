"""고캠핑 — 우리 캠핑장과 겹침(300m + 이름) · 새 관광지 행(source=GOCAMPING) · 시군구는 가까운 우리 관광지에서."""
from __future__ import annotations

import json

from src import gocamping


def site(cid: str, name: str, lat: float | None, lng: float | None, **kw) -> dict:
    """2026-10-07 basedList 운영 응답 모양(좌표는 문자열)."""
    return {"contentId": cid, "facltNm": name, "mapY": None if lat is None else str(lat), "mapX": None if lng is None else str(lng),
            "manageSttus": "운영", "addr1": "경상북도 김천시 아포읍 대성지1길 165", "lineIntro": "구미 김천 금오산 캠핑장",
            "intro": "", "tel": "010-8851-8055", "firstImageUrl": "https://gocamping.or.kr/upload/camp/8031",
            "modifiedtime": "2026-10-06", **kw}


def ours(id_: int, title: str, lat: float, lng: float, lcls2: str | None = "AC05", source: str | None = None,
         regn: str | None = "47", signgu: str | None = "150") -> dict:
    row = {"id": id_, "contentId": f"t{id_}", "lang": "ko", "title": title, "titleDisplay": title, "latitude": lat, "longitude": lng,
           "lclsSystm2": lcls2, "ldongRegnCd": regn, "ldongSignguCd": signgu}
    if source:
        row["source"] = source
    return row


def test_same_place_needs_300m_and_overlapping_name():
    # 이름 앞 4자·포함 일치 + 300m 안이면 같은 곳 — 새 행을 만들지 않는다
    camp = ours(1, "금오산 우리동네 캠핑장", 36.1070, 128.2747)
    far = ours(2, "우리동네 캠핑장", 36.1200, 128.2747)        # 약 1.4km
    other = ours(3, "솔밭 야영장", 36.1071, 128.2748)          # 가깝지만 이름이 다르다
    sites, new = gocamping.plan([site("8031", "우리동네 캠핑장", 36.1069736, 128.2746982)], [camp, far, other])

    assert sites[0]["matchedAttractionId"] == 1 and sites[0]["matchMethod"] == "NEAR_NAME"
    assert new == []
    assert json.loads(sites[0]["itemRaw"])["contentId"] == "8031"   # 원문 그대로


def test_new_row_is_gocamping_stay_with_region_from_nearest_attraction():
    neighbor = ours(9, "직지사", 36.1100, 128.2800, lcls2="A0201", regn="47", signgu="150")
    sites, new = gocamping.plan([site("8031", "우리동네 캠핑장", 36.1069736, 128.2746982)], [neighbor])

    assert sites[0]["matchedAttractionId"] is None and sites[0]["matchMethod"] == "NONE"
    [row] = new
    assert row["source"] == "GOCAMPING" and row["category"] == "stay" and row["lang"] == "ko"
    assert (row["contentId"], row["title"]) == ("8031", "우리동네 캠핑장")
    assert (row["ldongRegnCd"], row["ldongSignguCd"]) == ("47", "150")
    assert row["overview"] == "구미 김천 금오산 캠핑장"     # intro 가 비면 lineIntro
    assert row["sourceModifiedAt"] == "2026-10-06T00:00:00"


def test_not_our_campsite_when_other_source_or_far_region_unknown():
    # 다른 원천(고캠핑) 행과는 겹침을 보지 않는다 · 5km 안에 우리 관광지가 없으면 시군구를 모른다
    camp_other_source = ours(1, "우리동네 캠핑장", 36.1070, 128.2747, source="GOCAMPING")
    far_neighbor = ours(9, "먼 곳", 36.2000, 128.2747, lcls2="A0201")    # 약 10km
    sites, new = gocamping.plan([site("8031", "우리동네 캠핑장", 36.1069736, 128.2746982)], [camp_other_source, far_neighbor])

    assert sites[0]["matchedAttractionId"] is None
    assert (new[0]["ldongRegnCd"], new[0]["ldongSignguCd"]) == (None, None)


def test_no_coordinates_keeps_source_row_but_no_attraction():
    sites, new = gocamping.plan([site("9", "좌표 없는 캠핑장", None, None)], [])
    assert len(sites) == 1 and sites[0]["latitude"] is None
    assert new == []


def test_same_name_farther_than_300m_is_another_place():
    far = ours(2, "우리동네 캠핑장", 36.1200, 128.2747)        # 이름은 같고 약 1.4km
    sites, new = gocamping.plan([site("8031", "우리동네 캠핑장", 36.1069736, 128.2746982)], [far])
    assert sites[0]["matchedAttractionId"] is None and len(new) == 1


def test_nearby_campsite_with_other_name_is_another_place():
    other = ours(3, "솔밭 야영장", 36.1071, 128.2748)          # 20m 옆이지만 이름이 다르다
    sites, new = gocamping.plan([site("8031", "우리동네 캠핑장", 36.1069736, 128.2746982)], [other])
    assert sites[0]["matchedAttractionId"] is None and len(new) == 1
