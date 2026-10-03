"""이름 + 시군구 매칭 — 집중률·연관 관광지가 같이 쓰는 순수 함수.

실측(2026-10-02, 종로구·제주시·해운대구 원천 376곳 × 같은 시군구 국문 행 2,446)에서 설계 §2.1 의 수치가 그대로 나와야 한다:
정확 284 · 정규화까지 306 · 정규화 후보가 둘 이상인 이름 4 · 포함까지 332.
"""
from __future__ import annotations

from collections import Counter

from src import name_match
from tests.fixture_rows import load

SAMPLE = load("phase2-congestion.json")
NAMES: dict[str, list[str]] = SAMPLE["sourceNames"]
OURS = {sg: [{"id": i, "title": t} for i, t in rows] for sg, rows in SAMPLE["ours"].items()}


def _candidates(sigungu: str) -> list[name_match.Candidate]:
    return name_match.candidates_by_sigungu(
        {"id": r["id"], "title": r["title"], "lang": "ko", "ldongRegnCd": sigungu[:2], "ldongSignguCd": sigungu[2:]}
        for r in OURS[sigungu]
    )[sigungu]


def _all_matches() -> list[tuple[str, str, name_match.Match]]:
    out = []
    for sigungu, names in NAMES.items():
        cands = _candidates(sigungu)
        out += [(sigungu, n, name_match.match(n, cands)) for n in names]
    return out


def test_measured_three_sigungu_reproduce_the_design_numbers():
    matches = _all_matches()
    assert len(matches) == 376
    methods = Counter(m.method for _, _, m in matches)
    assert methods["EXACT"] == 284
    assert methods["EXACT"] + methods["NORMALIZED"] == 306
    # 포함은 후보 하나일 때만 잇는다 — 둘 이상이면 모호로 남는다. 포함 단계에 닿은 이름(잇든 못 잇든) 합이 설계의 「포함 일치 332」
    assert methods["CONTAINS"] == 21 and methods["AMBIGUOUS"] == 5
    assert 306 + methods["CONTAINS"] + methods["AMBIGUOUS"] == 332
    assert methods["NONE"] == 376 - 332
    # 잇는 방법이면 id 가 하나, 아니면 없다
    for _, _, m in matches:
        assert (m.attraction_id is not None) == (m.method in name_match.LINKED)


def test_four_names_have_several_normalized_candidates_and_exact_resolves_them_first():
    """정규화(괄호 안 제거)로 「열안지오름(봉개동)」·「열안지오름(오라동)」이 같은 키가 된다 — 정확 단계를 먼저 해야 둘이 각자 자기 행에 붙는다."""
    several = []
    for sigungu, names in NAMES.items():
        by_key = Counter(name_match.normalize(c.title) for c in _candidates(sigungu))
        several += [(sigungu, n) for n in names if by_key[name_match.normalize(n)] > 1]
    assert len(several) == 4
    found = {n: m for sg, n, m in _all_matches() if (sg, n) in several}
    assert {m.method for m in found.values()} == {"EXACT"}
    assert found["열안지오름(봉개동)"].attraction_id != found["열안지오름(오라동)"].attraction_id


def test_normalize_drops_brackets_spaces_and_punctuation():
    assert name_match.normalize("세검정 터 (구 세검정)") == "세검정터"
    assert name_match.normalize("거문오름 [세계자연유산]") == "거문오름"
    assert name_match.normalize("바리메 / 바리메오름") == "바리메바리메오름"
    assert name_match.normalize("9.81 파크 제주") == "981파크제주"
    assert name_match.normalize("우도(해양도립공원)") == "우도"


def test_contains_needs_three_characters_and_a_single_candidate():
    cands = [name_match.Candidate(1, "제주해녀박물관"), name_match.Candidate(2, "청와대 사랑채"), name_match.Candidate(3, "청와대칠궁")]
    assert name_match.match("해녀박물관", cands) == name_match.Match(1, "CONTAINS", (1,))
    # 짧은 쪽이 2자면 포함으로 잇지 않는다
    assert name_match.match("해녀", cands).method == "NONE"
    # 두 곳을 품으면 모호 — 잇지 않는다
    assert name_match.match("청와대", cands) == name_match.Match(None, "AMBIGUOUS", (2, 3))


def test_exact_duplicates_with_different_ids_are_ambiguous():
    cands = [name_match.Candidate(1, "보성시장"), name_match.Candidate(2, "보성시장")]
    assert name_match.match("보성시장", cands) == name_match.Match(None, "AMBIGUOUS", (1, 2))


def test_candidates_are_korean_rows_keyed_by_the_legal_dong_sigungu_code():
    rows = [
        {"id": 1, "title": "경복궁", "lang": "ko", "ldongRegnCd": "11", "ldongSignguCd": "110"},
        {"id": 2, "title": "Gyeongbokgung", "lang": "en", "ldongRegnCd": "11", "ldongSignguCd": "110"},
        {"id": 3, "title": "시군구 없음", "lang": "ko", "ldongRegnCd": "11", "ldongSignguCd": None},
    ]
    assert name_match.candidates_by_sigungu(rows) == {"11110": [name_match.Candidate(1, "경복궁")]}


def C(i, title, type_id, overview_len):  # noqa: N802 — 겹친 후보 픽스처
    return name_match.Candidate(i, title, content_type_id=type_id, overview_len=overview_len)


def test_same_place_listed_as_sight_and_shop_resolves_to_the_sight():
    # 부산타워 운영 행(2026-10-03): 관광지 12 · 개요 317자 / 쇼핑 38 · 개요 118자
    cands = [C(2558, "부산타워", "12", 317), C(29692, "부산타워", "38", 118)]
    assert name_match.match("부산타워", cands) == name_match.Match(2558, "EXACT", (2558, 29692))


def test_same_type_listed_twice_resolves_to_the_longer_overview():
    # 익선동 한옥거리 운영 행: 둘 다 관광지 12 · 개요 301자 / 230자
    cands = [C(7535, "익선동 한옥거리", "12", 301), C(13391, "익선동 한옥거리", "12", 230)]
    assert name_match.match("익선동 한옥거리", cands) == name_match.Match(7535, "EXACT", (7535, 13391))


def test_two_sights_of_different_types_or_equal_overviews_stay_ambiguous():
    mixed = [C(1, "전시관", "12", 300), C(2, "전시관", "14", 100)]
    assert name_match.match("전시관", mixed) == name_match.Match(None, "AMBIGUOUS", (1, 2))
    tie = [C(1, "시장", "12", 200), C(2, "시장", "12", 200)]
    assert name_match.match("시장", tie) == name_match.Match(None, "AMBIGUOUS", (1, 2))


def test_two_shops_with_one_longer_overview_resolve_and_a_sight_beats_two_shops():
    shops = [C(1, "몰", "38", 120), C(2, "몰", "38", 430)]
    assert name_match.match("몰", shops).attraction_id == 2
    sight_and_shops = [C(1, "타워", "38", 900), C(2, "타워", "38", 100), C(3, "타워", "12", 50)]
    assert name_match.match("타워", sight_and_shops).attraction_id == 3


def test_candidates_carry_type_and_overview_length_for_settling():
    rows = [{"id": "5", "lang": "ko", "title": "부산타워", "ldongRegnCd": "26", "ldongSignguCd": "110",
             "contentTypeId": "38", "overview": "가" * 118}]
    assert name_match.candidates_by_sigungu(rows) == {"26110": [C(5, "부산타워", "38", 118)]}
