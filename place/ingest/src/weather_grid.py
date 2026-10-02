"""날씨 단위 — 시군구 대표점 → 기상청 단기예보 격자(nx, ny) · 중기예보 구역(육상 권역 · 기온 regId).

화면 단위는 시군구다. 관광지 좌표 그대로면 고유 격자가 3,671개라 한 회차가 하루 한도를 넘는다 —
시군구 대표점(`administrative_regions` 좌표, 그 시군구 관광지 좌표 평균) 269 → 좌표 있는 267 → 고유 격자 243
(2026-10-02 운영 값). 부천시·안산시는 자치구 행이 따로 있고 시 행에는 좌표가 없어 날씨가 없다.

격자는 기상청 람베르트 정각원추 격자(5km, 표준위도 30°·60°, 기준점 126°E·38°N, 원점 (43, 136))다.
식은 기상청 「단기예보 조회서비스 오픈API 활용가이드」의 변환 식이고, 같은 자료의 격자_위경도 표(2607)로 검산한다.

중기 구역은 기상청 「중기예보 조회서비스 오픈API 활용가이드」(241128)와 첨부 「중기기온예보구역코드」(2025.12)가 원천이다 —
육상 권역 10(`getMidLandFcst`)은 활용가이드 표, 기온 regId 는 첨부 표의 도시(C) 코드 중 남한 176개(북한 11I·11J·11K·11L 제외).
시군구 → 기온 regId 는 ① 이름 일치(같은 권역 안) ② 광역시·특별시 자치구는 그 도시 ③ 광역시 소속 군도 그 광역시
④ 나머지는 같은 권역 안 최근접 도시(도시 좌표 = ①②③ 으로 그 도시에 붙은 시군구 대표점의 평균) 순서다. 육상 권역은 기온 regId 의 앞자리가 정한다
(강원은 시도 하나가 영서·영동 둘로 갈려서 시도로는 못 정한다).
"""
from __future__ import annotations

import math
from collections import defaultdict

#: 람베르트 정각원추 격자 상수 — 기상청 활용가이드 값.
EARTH_KM = 6371.00877
GRID_KM = 5.0
SLAT1, SLAT2 = 30.0, 60.0
OLON, OLAT = 126.0, 38.0
XO, YO = 43, 136

#: 중기 육상 권역 — 활용가이드 「중기육상예보구역 코드 정보 표」.
MID_LAND: dict[str, str] = {
    "11B00000": "서울, 인천, 경기도", "11D10000": "강원도영서", "11D20000": "강원도영동",
    "11C20000": "대전, 세종, 충청남도", "11C10000": "충청북도", "11F20000": "광주, 전라남도",
    "11F10000": "전북자치도", "11H10000": "대구, 경상북도", "11H20000": "부산, 울산, 경상남도", "11G00000": "제주도",
}

#: 중기 기온 regId — 첨부 「중기기온예보구역코드」(2025.12) 의 도시(C) 코드, 남한만. 이름은 표 그대로.
MID_TA: tuple[tuple[str, str], ...] = (
    ("11A00101", "백령도"), ("11B10101", "서울"), ("11B10102", "과천"), ("11B10103", "광명"), ("11B20101", "강화"),
    ("11B20102", "김포"), ("11B20201", "인천"), ("11B20202", "시흥"), ("11B20203", "안산"), ("11B20204", "부천"),
    ("11B20301", "의정부"), ("11B20302", "고양"), ("11B20304", "양주"), ("11B20305", "파주"), ("11B20401", "동두천"),
    ("11B20402", "연천"), ("11B20403", "포천"), ("11B20404", "가평"), ("11B20501", "구리"), ("11B20502", "남양주"),
    ("11B20503", "양평"), ("11B20504", "하남"), ("11B20601", "수원"), ("11B20602", "안양"), ("11B20603", "오산"),
    ("11B20604", "화성"), ("11B20605", "성남"), ("11B20606", "평택"), ("11B20609", "의왕"), ("11B20610", "군포"),
    ("11B20611", "안성"), ("11B20612", "용인"), ("11B20701", "이천"), ("11B20702", "광주"), ("11B20703", "여주"),
    ("11C10101", "충주"), ("11C10102", "진천"), ("11C10103", "음성"), ("11C10201", "제천"), ("11C10202", "단양"),
    ("11C10301", "청주"), ("11C10302", "보은"), ("11C10303", "괴산"), ("11C10304", "증평"), ("11C10401", "추풍령"),
    ("11C10402", "영동"), ("11C10403", "옥천"), ("11C20101", "서산"), ("11C20102", "태안"), ("11C20103", "당진"),
    ("11C20104", "홍성"), ("11C20201", "보령"), ("11C20202", "서천"), ("11C20301", "천안"), ("11C20302", "아산"),
    ("11C20303", "예산"), ("11C20401", "대전"), ("11C20402", "공주"), ("11C20403", "계룡"), ("11C20404", "세종"),
    ("11C20501", "부여"), ("11C20502", "청양"), ("11C20601", "금산"), ("11C20602", "논산"), ("11D10101", "철원"),
    ("11D10102", "화천"), ("11D10201", "인제"), ("11D10202", "양구"), ("11D10301", "춘천"), ("11D10302", "홍천"),
    ("11D10401", "원주"), ("11D10402", "횡성"), ("11D10501", "영월"), ("11D10502", "정선"), ("11D10503", "평창"),
    ("11D20201", "대관령"), ("11D20301", "태백"), ("11D20401", "속초"), ("11D20402", "고성"), ("11D20403", "양양"),
    ("11D20501", "강릉"), ("11D20601", "동해"), ("11D20602", "삼척"), ("11E00101", "울릉도"), ("11E00102", "독도"),
    ("11F10201", "전주"), ("11F10202", "익산"), ("11F10203", "정읍"), ("11F10204", "완주"), ("11F10301", "장수"),
    ("11F10302", "무주"), ("11F10303", "진안"), ("11F10401", "남원"), ("11F10402", "임실"), ("11F10403", "순창"),
    ("11F20301", "완도"), ("11F20302", "해남"), ("11F20303", "강진"), ("11F20304", "장흥"), ("11F20401", "여수"),
    ("11F20402", "광양"), ("11F20403", "고흥"), ("11F20404", "보성"), ("11F20405", "순천시"), ("11F20501", "광주"),
    ("11F20502", "장성"), ("11F20503", "나주"), ("11F20504", "담양"), ("11F20505", "화순"), ("11F20601", "구례"),
    ("11F20602", "곡성"), ("11F20603", "순천"), ("11F20701", "흑산도"), ("11G00101", "성산"), ("11G00201", "제주"),
    ("11G00302", "성판악"), ("11G00401", "서귀포"), ("11G00501", "고산"), ("11G00601", "이어도"), ("11G00800", "추자도"),
    ("11G00901", "산천단"), ("11G01001", "한남"), ("11H10101", "울진"), ("11H10102", "영덕"), ("11H10201", "포항"),
    ("11H10202", "경주"), ("11H10301", "문경"), ("11H10302", "상주"), ("11H10303", "예천"), ("11H10401", "영주"),
    ("11H10402", "봉화"), ("11H10403", "영양"), ("11H10501", "안동"), ("11H10502", "의성"), ("11H10503", "청송"),
    ("11H10601", "김천"), ("11H10602", "구미"), ("11H10604", "고령"), ("11H10605", "성주"), ("11H10701", "대구"),
    ("11H10702", "영천"), ("11H10703", "경산"), ("11H10704", "청도"), ("11H10705", "칠곡"), ("11H10707", "군위"),
    ("11H20101", "울산"), ("11H20102", "양산"), ("11H20201", "부산"), ("11H20301", "창원"), ("11H20304", "김해"),
    ("11H20401", "통영"), ("11H20402", "사천"), ("11H20403", "거제"), ("11H20404", "고성"), ("11H20405", "남해"),
    ("11H20501", "함양"), ("11H20502", "거창"), ("11H20503", "합천"), ("11H20601", "밀양"), ("11H20602", "의령"),
    ("11H20603", "함안"), ("11H20604", "창녕"), ("11H20701", "진주"), ("11H20703", "산청"), ("11H20704", "하동"),
    ("21F10501", "군산"), ("21F10502", "김제"), ("21F10601", "고창"), ("21F10602", "부안"), ("21F20101", "함평"),
    ("21F20102", "영광"), ("21F20201", "진도"), ("21F20801", "목포"), ("21F20802", "영암"), ("21F20803", "신안"),
    ("21F20804", "무안"),
)

#: 시도(법정동 2자리) → 가능한 육상 권역. 12 는 전남광주통합특별시(옛 29 광주 · 46 전남).
SIDO_LANDS: dict[str, frozenset[str]] = {
    "11": frozenset({"11B00000"}), "28": frozenset({"11B00000"}), "41": frozenset({"11B00000"}),
    "51": frozenset({"11D10000", "11D20000"}), "43": frozenset({"11C10000"}),
    "30": frozenset({"11C20000"}), "36": frozenset({"11C20000"}), "44": frozenset({"11C20000"}),
    "52": frozenset({"11F10000"}), "12": frozenset({"11F20000"}), "29": frozenset({"11F20000"}), "46": frozenset({"11F20000"}),
    "27": frozenset({"11H10000"}), "47": frozenset({"11H10000"}),
    "26": frozenset({"11H20000"}), "31": frozenset({"11H20000"}), "48": frozenset({"11H20000"}),
    "50": frozenset({"11G00000"}),
}

#: 광역시·특별시 자치구 → 그 도시의 기온 regId. 자치구 이름(중구·남구 …)은 도시 이름이 아니라 이름 일치가 없다.
METRO_TA: dict[str, str] = {
    "11": "11B10101", "26": "11H20201", "27": "11H10701", "28": "11B20201", "12": "11F20501", "29": "11F20501",
    "30": "11C20401", "31": "11H20101", "36": "11C20404",
}

#: 광역시 소속 군(기장·달성·옹진·울주 …)은 그 광역시 regId 를 쓴다 — 최근접으로 두면 기장군이 양산, 옹진군이 강화로 간다.
#: 전남광주통합특별시(12)의 군은 광주가 아니라 전남 군이라 넣지 않는다(이름 일치 · 최근접으로 간다).
METRO_COUNTY_SIDO = frozenset({"26", "27", "28", "31"})

_NAME_SUFFIXES = ("특별자치시", "특별자치도", "특별시", "광역시", "시", "군", "구")


def to_grid(lat: float, lon: float) -> tuple[int, int]:
    """위경도 → 기상청 격자 (nx, ny). 활용가이드의 변환 식 그대로(반올림은 floor(x + 0.5))."""
    deg = math.pi / 180.0
    re = EARTH_KM / GRID_KM
    slat1, slat2, olon, olat = SLAT1 * deg, SLAT2 * deg, OLON * deg, OLAT * deg
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(
        math.tan(math.pi * 0.25 + slat2 * 0.5) / math.tan(math.pi * 0.25 + slat1 * 0.5))
    sf = math.pow(math.tan(math.pi * 0.25 + slat1 * 0.5), sn) * math.cos(slat1) / sn
    ro = re * sf / math.pow(math.tan(math.pi * 0.25 + olat * 0.5), sn)
    ra = re * sf / math.pow(math.tan(math.pi * 0.25 + lat * deg * 0.5), sn)
    theta = lon * deg - olon
    if theta > math.pi:
        theta -= 2.0 * math.pi
    if theta < -math.pi:
        theta += 2.0 * math.pi
    theta *= sn
    return int(math.floor(ra * math.sin(theta) + XO + 0.5)), int(math.floor(ro - ra * math.cos(theta) + YO + 0.5))


def land_of(ta_reg_id: str) -> str:
    """기온 regId → 육상 권역. 앞자리가 권역이다(11B…→서울·인천·경기, 11D2…→강원영동, 21F1…→전북 …)."""
    if ta_reg_id.startswith(("11A", "11B")):
        return "11B00000"                 # 11A00101 백령도는 인천 옹진
    if ta_reg_id.startswith("11E"):
        return "11H10000"                 # 울릉도·독도는 경북
    if ta_reg_id.startswith("11G"):
        return "11G00000"
    prefix = ta_reg_id[:4]
    lands = {"11C1": "11C10000", "11C2": "11C20000", "11D1": "11D10000", "11D2": "11D20000",
             "11F1": "11F10000", "21F1": "11F10000", "11F2": "11F20000", "21F2": "11F20000",
             "11H1": "11H10000", "11H2": "11H20000"}
    if prefix not in lands:
        raise ValueError(f"권역을 모르는 기온 regId: {ta_reg_id}")
    return lands[prefix]


def _short_name(name: str) -> str:
    """「수원시 장안구」→「수원」, 「고성군」→「고성」, 「세종특별자치시」→「세종」. 두 글자 미만이 되면 자르지 않는다."""
    head = name.split(" ")[0]
    for suffix in _NAME_SUFFIXES:
        if head.endswith(suffix) and len(head) - len(suffix) >= 2:
            return head[: -len(suffix)]
    return head


def distance_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """두 (위도, 경도) 사이 대권 거리(km). 대기 측정소 최근접(`air`)도 이것을 쓴다."""
    la1, lo1, la2, lo2 = (math.radians(v) for v in (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(h))


def _by_name(region: dict, candidates: list[tuple[str, str]]) -> str | None:
    head = region["name"].split(" ")[0]
    short = _short_name(region["name"])
    for test in (lambda n: n == head, lambda n: n == short, lambda n: n.startswith(short)):
        hits = [code for code, name in candidates if test(name)]
        if len(hits) == 1:
            return hits[0]
        if len(hits) > 1:
            return None                   # 같은 권역 안에서 둘 이상이면 이름으로 정하지 않는다
    return None


def assign(regions: list[dict]) -> list[dict]:
    """시군구 행(`code`·`parentCode`·`name`·`latitude`·`longitude`) → 날씨 단위.

    좌표 없는 시군구와 권역을 모르는 시도는 빠진다(받을 격자가 없다). 반환 행은 place `weather_sigungu_grid` 행과 같은 모양이다.
    """
    rows = [r for r in regions if r.get("level", "SIGUNGU") == "SIGUNGU"
            and r.get("latitude") is not None and r.get("longitude") is not None
            and (r.get("parentCode") or r["code"][:2]) in SIDO_LANDS]
    ta: dict[str, tuple[str, str]] = {}
    for r in rows:
        sido = r.get("parentCode") or r["code"][:2]
        candidates = [(c, n) for c, n in MID_TA if land_of(c) in SIDO_LANDS[sido]]
        hit = _by_name(r, candidates)
        if hit:
            ta[r["code"]] = (hit, "NAME")
        elif sido in METRO_TA and r["name"].endswith("구") and " " not in r["name"]:
            ta[r["code"]] = (METRO_TA[sido], "METRO")
        elif sido in METRO_COUNTY_SIDO and r["name"].endswith("군"):
            ta[r["code"]] = (METRO_TA[sido], "METRO_COUNTY")

    points: dict[str, list[tuple[float, float]]] = defaultdict(list)
    for r in rows:
        if r["code"] in ta:
            points[ta[r["code"]][0]].append((r["latitude"], r["longitude"]))
    centers = {code: (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)) for code, pts in points.items()}

    out = []
    for r in rows:
        sido = r.get("parentCode") or r["code"][:2]
        here = (r["latitude"], r["longitude"])
        if r["code"] not in ta:
            near = [c for c, _ in MID_TA if land_of(c) in SIDO_LANDS[sido] and c in centers]
            if near:
                ta[r["code"]] = (min(near, key=lambda c: distance_km(here, centers[c])), "NEAREST")
        reg, how = ta.get(r["code"], (None, None))
        nx, ny = to_grid(*here)
        out.append({"sigunguCode": r["code"], "nx": nx, "ny": ny,
                    "landRegId": land_of(reg) if reg else None, "taRegId": reg, "taMatch": how})
    return out


def mid_regions() -> list[dict]:
    """`weather_mid_region` 시드 — 육상 10 + 기온 176. 이름은 기상청 표 그대로."""
    return ([{"regId": c, "kind": "LAND", "name": n} for c, n in MID_LAND.items()]
            + [{"regId": c, "kind": "TA", "name": n} for c, n in MID_TA])
