#!/usr/bin/env python3
"""place-ingest 스모크 — 가짜 place API 로 수집 경로를 끝까지 태운다. 의존 없음(표준 라이브러리).

    cd place/ingest && python3 -m tests.smoke_test

CI 게이트가 아니라 **배포 전 수동 확인**이다. 여기서 잡으려는 것은 하나다:
원천이 빈 개요를 준 것(negative cache 대상)과 일시적 실패(429·네트워크)를 섞지 않는가.
섞으면 실패한 레코드가 영영 재시도되지 않고, 며칠치 수집이 조용히 사라진다.
"""
from __future__ import annotations

import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(os.environ.get("SMOKE_PORT", "18099"))

ROWS = [
    {"id": 1, "contentId": "126508", "lang": "ko", "title": "경복궁", "latitude": 37.5788,
     "longitude": 126.977, "category": "history", "imageUrl": "http://img/1", "overview": None},
    {"id": 2, "contentId": "264337", "lang": "en", "title": "Gyeongbokgung", "latitude": 37.5788,
     "longitude": 126.977, "category": "history", "imageUrl": None, "overview": None},
    {"id": 3, "contentId": "999", "lang": "ko", "title": "개요있음", "latitude": 35.1,
     "longitude": 129.0, "category": "food", "overview": "이미 있음"},
]
POSTED: dict[str, list] = {"bulk": [], "probes": []}


class FakePlace(BaseHTTPRequestHandler):
    def log_message(self, *args):  # 조용히
        pass

    def _send(self, payload: dict) -> None:
        body = json.dumps({"data": payload}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/api/places/attractions/overview-probes"):
            self._send({"keys": ["ko:126508"], "total": 1})   # 경복궁은 원천 개요없음으로 제외
        elif self.path.startswith("/api/places/attractions?"):
            self._send({"attractions": ROWS, "totalElements": len(ROWS),
                        "totalPages": 1, "currentPage": 0})
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if self.path.endswith("/bulk"):
            POSTED["bulk"] += body["attractions"]
            self._send({"created": 0, "updated": len(body["attractions"]), "total": len(ROWS)})
        else:
            POSTED["probes"] += body["probes"]
            self._send({"recorded": len(body["probes"])})


def main() -> int:
    server = HTTPServer(("127.0.0.1", PORT), FakePlace)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    os.environ["PLACE_API"] = f"http://127.0.0.1:{PORT}"

    from src import backfill_overview as bo
    from src import place_client

    rows = place_client.fetch_attractions()
    assert len(rows) == len(ROWS), rows
    known = place_client.fetch_probe_keys()
    assert known == {"ko:126508"}, known

    # 제외 목록과 "이미 개요 있음"이 둘 다 걸러진다
    assert bo.pick(rows, "ko", 10, known) == [], "ko 는 전부 제외 대상이다"
    assert [r["contentId"] for r in bo.pick(rows, "en", 10, known)] == ["264337"]

    calls: list[str] = []

    def fake_tour_get(_key, _service, _op, params):
        calls.append(params["contentId"])
        if params["contentId"] == "A":
            return {"items": {"item": [{"overview": "  내용  "}]}}
        if params["contentId"] == "B":
            return {"items": {"item": [{"overview": ""}]}}   # 원천이 빈 값
        raise RuntimeError("429 Too Many Requests")           # 일시적 실패

    bo.tour_get = fake_tour_get
    targets = [
        {"contentId": "A", "lang": "ko", "title": "가", "latitude": 1.0, "longitude": 2.0,
         "category": "nature"},
        {"contentId": "B", "lang": "ko", "title": "나", "latitude": 1.0, "longitude": 2.0},
        {"contentId": "C", "lang": "ko", "title": "다", "latitude": 1.0, "longitude": 2.0},
    ]
    records, empty = bo.collect("key", targets)

    assert calls == ["A", "B", "C"], calls
    assert [r["contentId"] for r in records] == ["A"], records
    assert records[0]["overview"] == "내용", records[0]
    # 핵심: 429 인 C 는 negative cache 에 들어가지 않는다 (들어가면 영영 재시도 안 됨)
    assert [e["contentId"] for e in empty] == ["B"], empty

    place_client.bulk_upsert(records)
    place_client.record_probes(empty)
    assert len(POSTED["bulk"]) == 1 and POSTED["bulk"][0]["contentId"] == "A", POSTED["bulk"]
    assert POSTED["probes"] == [{"contentId": "B", "lang": "ko"}], POSTED["probes"]

    _youtube_matcher()
    _admin_region_parser()

    print("SMOKE OK — 제외목록 · 429 분리 · 전체 레코드 적재 · 매칭 필터 · 법정동 파서 · 영문명 추출")
    return 0


def _youtube_matcher() -> None:
    """관광지명이 제목·설명에 없는 결과는 버린다 — "경복궁" 검색에 무관한 것이 섞여 온다.

    유튜브와 블로그가 **같은 판단**을 쓰는지도 여기서 본다. 소스마다 기준이 갈리면
    같은 관광지에 붙는 콘텐츠 품질이 소스마다 달라진다.
    """
    from src import naver
    from src.linkmatch import matches, normalize, strip_tags

    assert matches("경복궁", "서울 경복궁 브이로그", "")
    assert matches("Gyeongbokgung Palace", "Seoul walk", "we visit Gyeongbokgung Palace")
    assert not matches("경복궁", "부산 맛집 투어", "해운대")
    # 공백·문장부호는 무시하고 붙여서 본다
    assert matches("전주 한옥마을", "전주한옥마을 1박2일", "")
    # 이름이 통째로 사라지는 입력은 매칭하지 않는다 (아무거나 붙는 것을 막는다)
    assert not matches("!!!", "무엇이든", "")
    assert normalize("전주 한옥마을!") == "전주한옥마을"

    # 네이버는 매칭 구간을 <b> 로 감싸 준다 — 걷어내지 않으면 태그가 제목에 남는다
    assert strip_tags("<b>경복궁</b> 나들이") == "경복궁 나들이"
    assert naver._post_date("20260819") == "2026-08-19T00:00:00"
    assert naver._post_date("2026") is None


def _admin_region_parser() -> None:
    """법정동코드 자료에서 시도·시군구만 뽑는다 — 읍면동과 폐지 코드는 버린다."""
    from src.admin_region import parse

    rows = parse([
        "법정동코드\t법정동명\t폐지여부",
        "1100000000\t서울특별시\t존재",
        "1111000000\t서울특별시 종로구\t존재",
        "1111010100\t서울특별시 종로구 청운동\t존재",   # 읍면동 — 탐색 단위가 아니다
        "2600000000\t부산광역시\t폐지",                  # 폐지 코드
        "4100000000\t경기도\t존재",
        "4111000000\t경기도 수원시\t존재",
        "4111100000\t경기도 수원시 장안구\t존재",
    ])

    assert [r["code"] for r in rows] == ["11", "11110", "41", "41110", "41111"], rows
    # 상위를 이미 골랐으므로 시도 접두는 떼고 보인다
    assert rows[1]["name"] == "종로구"
    # 시(수원시)와 자치구(수원시 장안구)가 둘 다 5자리다 — 어느 쪽을 쓸지 여기서 정하지 않는다
    assert rows[3]["name"] == "수원시" and rows[4]["name"] == "수원시 장안구"
    assert all(r["parentCode"] == r["code"][:2] for r in rows if r["level"] == "SIGUNGU")

    _english_from_address()
    _sejong_has_a_sido()
    _ldong_normalization()
    _view_count_sorting()
    _categorize_rules()


def _english_from_address() -> None:
    """영문 시군구명은 tokens[-2] 로 고정하면 안 된다 — 시 아래 자치구가 있으면 한 칸 밀린다.

    어느 칸을 볼지는 법정동 한글명의 단어 수가 정한다.
    """
    from src.admin_region import SIDO_EN, _english_sigungu

    # 1단어 이름 → 뒤에서 두 번째
    assert _english_sigungu("종로구", "161 Sajik-ro, Jongno-gu, Seoul") == "Jongno-gu"
    assert _english_sigungu("경주시", "385 Bulguk-ro, Gyeongju-si, Gyeongsangbuk-do") == "Gyeongju-si"
    # 건물명이 앞에 붙어도 뒤에서 세면 영향이 없다
    assert _english_sigungu(
        "영등포구", "CM Chungmu Hospital, 13 Yeongdeungpo-ro 36-gil, Yeongdeungpo-gu, Seoul",
    ) == "Yeongdeungpo-gu"
    # 2단어 이름(시 아래 자치구) → 한 칸 더 앞을 함께 본다
    assert _english_sigungu(
        "전주시 완산구", "99 Girin-daero, Wansan-gu, Jeonju-si, Jeollabuk-do",
    ) == "Wansan-gu, Jeonju-si"
    # 숫자가 섞이면 주소 형식이 깨진 것 — 버린다
    assert _english_sigungu("종로구", "161 Sajik-ro, Seoul") is None
    assert _english_sigungu("종로구", "Seoul") is None

    # 시도 영문은 상수다. 값은 2026-08-20 자 실제 자료 기준 — 광주(29)·전남(46)은 폐지되고
    # 전남광주통합특별시(12)로 합쳐졌다. 그래서 29/46 은 상수에 없어야 한다.
    assert "29" not in SIDO_EN and "46" not in SIDO_EN
    assert SIDO_EN["12"].startswith("Jeonnam-Gwangju")
    assert SIDO_EN["51"] == "Gangwon-do" and SIDO_EN["52"] == "Jeonbuk-do"


def _categorize_rules() -> None:
    """분류 매핑 — 의료관광 제외와 EX 하위 분해가 핵심이다."""
    from src.sync_tour import categorize

    # 의료관광은 관광지가 아니다. 구 분류가 뭐라 해도 앞단에서 걸러진다.
    assert categorize("", "", "EX", "EX05", "EX050800") == "etc"
    assert categorize("A02", "A0201", "EX", "EX05", "EX050800") == "etc"
    # EX 하위 분해 — 체험은 문화, 온천·액티비티는 레저
    assert categorize("", "", "EX", "EX02", "EX020100") == "culture"   # 공예
    assert categorize("", "", "EX", "EX03", "EX030100") == "culture"   # 체험마을
    assert categorize("", "", "EX", "EX05", "EX050100") == "leisure"   # 온천
    assert categorize("", "", "EX", "EX07", "EX070100") == "leisure"   # 케이블카
    # 구 분류만 있으면 그대로 쓴다
    assert categorize("A02", "A0201", "", "", "") == "history"
    assert categorize("", "", "NA", "", "") == "nature"
    assert categorize("", "", "SH", "SH04", "") == "shopping"

    # ── 두 체계가 부딪히면 **좁게 말하는 쪽**이 이긴다 (2026-08-21 실측 517건) ──
    # 온천/스파: 구 코드는 A0202(자연)라지만 EX05 가 더 구체적이다.
    # 실제로 `Q Spa & Clinic` 이 이것 때문에 자연으로 목록에 떠 있었다.
    assert categorize("A02", "A0202", "EX", "EX05", "EX050100") == "leisure"
    assert categorize("A02", "A0202", "EX", "EX07", "EX070100") == "leisure"
    # 캠핑장: 신 대분류 AC(숙박)보다 구 중분류 A03(레포츠)가 맞다 — 대분류는 최후 폴백이라
    # 통째로 신 체계를 앞세웠다면 여기서 1,335건이 목록에서 사라졌다.
    assert categorize("A03", "A0302", "AC", "AC05", "AC050100") == "leisure"
    # 구 코드가 없으면 신 대분류가 받는다
    assert categorize("", "", "AC", "AC05", "AC050100") == "stay"


def _view_count_sorting() -> None:
    """조회수 내림차순, 못 받은 것은 뒤로 — 순서를 뒤집을 근거가 없다."""
    links = [
        {"externalId": "none", "viewCount": None},
        {"externalId": "low", "viewCount": 500},
        {"externalId": "high", "viewCount": 9000},
    ]
    links.sort(key=lambda l: (l["viewCount"] is None, -(l["viewCount"] or 0)))
    assert [l["externalId"] for l in links] == ["high", "low", "none"]


def _ldong_normalization() -> None:
    """세종은 두 필드 모두 5자리로 온다 — 그대로 저장하면 시도 코드와 조인이 안 된다."""
    from src.sync_tour import _ldong

    assert _ldong({"lDongRegnCd": "11", "lDongSignguCd": "110"}) == {
        "ldongRegnCd": "11", "ldongSignguCd": "110"}
    # 세종: 36110 → 36 / 110 (admin_regions 의 36 + 36110 과 맞는다)
    assert _ldong({"lDongRegnCd": "36110", "lDongSignguCd": "36110"}) == {
        "ldongRegnCd": "36", "ldongSignguCd": "110"}
    assert _ldong({}) == {"ldongRegnCd": None, "ldongSignguCd": None}


def _sejong_has_a_sido() -> None:
    """시도 행이 없는데 시군구만 있는 경우를 메운다 — 안 메우면 드릴다운에서 사라진다.

    실제 자료에 `3600000000` 이 없고 `3611000000 세종특별자치시` 만 있다.
    """
    from src.admin_region import parse

    rows = parse([
        "1100000000\t서울특별시\t존재",
        "1111000000\t서울특별시 종로구\t존재",
        "3611000000\t세종특별자치시\t존재",     # 상위(3600000000)가 자료에 없다
        "3611010100\t세종특별자치시 반곡동\t존재",
    ])
    by_code = {r["code"]: r for r in rows}
    assert by_code["36"]["level"] == "SIDO" and by_code["36"]["name"] == "세종특별자치시"
    assert by_code["36110"]["parentCode"] == "36"
    # 부모 없는 시군구가 남지 않는다
    sido = {r["code"] for r in rows if r["level"] == "SIDO"}
    assert all(r["parentCode"] in sido for r in rows if r["level"] == "SIGUNGU")
    # 내부 표시용 키가 새어 나가지 않는다
    assert all("_fullName" not in r for r in rows)


if __name__ == "__main__":
    sys.exit(main())
