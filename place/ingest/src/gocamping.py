"""고캠핑 캠핑장 (data.go.kr 15101933, `GoCamping/basedList`) — 자기 번호 체계를 가진 첫 원천 (ADR-0104 Q-P2-KEY).

`basedList` 한 콜(numOfRows=4000)에 전량(약 3,100곳, 7MB)이 온다. 행 원문 82키는 place `gocamping_site` 에 그대로 둔다.

- **겹침**: 우리 TourAPI 캠핑장(신분류 야영장 `AC05`)과 300m 안이면서 이름이 겹치면 같은 곳이다 — 새 관광지 행을 만들지 않고
  원천 표에 `matched_attraction_id` 만 남긴다(설계 실측 705곳).
- **새 행**: 겹치지 않는 곳만 `source=GOCAMPING` · 분류 `stay` 관광지 행이 된다. 좌표가 없으면 만들지 않는다.
- **시군구**: 원천은 시도·시군구 이름만 준다(「강원도」처럼 우리 이름과 다르다). 가장 가까운 우리 관광지의 법정동 코드를 쓴다(5km 안).
"""
from __future__ import annotations

import json
import math
import re
from datetime import datetime

from src import datagokr, place_client

API = "GoCamping"
PATH = f"B551011/{API}/basedList"
ROWS = 4000
#: 같은 곳으로 볼 거리
SAME_PLACE_M = 300
#: 시군구를 빌려 올 이웃 관광지 거리 상한
REGION_NEIGHBOR_M = 5000
#: 우리 캠핑장 — TourAPI 신분류 야영장
CAMPSITE_LCLS2 = "AC05"
_COMMON = {"MobileOS": "ETC", "MobileApp": "msa-seed", "_type": "json"}
_GRID = 0.05   # 약 5km 칸 — 이웃 찾기를 칸 안팎으로 좁힌다


def log(msg: str) -> None:
    print(f"[gocamping] {msg}", flush=True)


def fetch(client: datagokr.Client) -> list[dict]:
    body = client.get(PATH, {**_COMMON, "numOfRows": ROWS, "pageNo": 1}, "고캠핑 basedList")
    return datagokr.items(body)


def _norm(name: str) -> str:
    return re.sub(r"[\s\W_]+", "", name or "").lower()


def same_name(a: str, b: str) -> bool:
    """이름이 겹치는가 — 공백·기호를 뺀 앞 4자가 같거나 한쪽이 다른 쪽을 품는다(설계 실측 기준)."""
    x, y = _norm(a), _norm(b)
    if not x or not y:
        return False
    return x[:4] == y[:4] or x in y or y in x


def distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _coord(site: dict) -> tuple[float, float] | None:
    try:
        lat, lng = float(site.get("mapY")), float(site.get("mapX"))
    except (TypeError, ValueError):
        return None
    return (lat, lng) if 33.0 <= lat <= 38.7 and 124.5 <= lng <= 132.0 else None


class _Grid:
    def __init__(self, rows: list[dict]):
        self.cells: dict[tuple[int, int], list[dict]] = {}
        for r in rows:
            lat, lng = r.get("latitude"), r.get("longitude")
            if lat is None or lng is None:
                continue
            self.cells.setdefault((int(lat / _GRID), int(lng / _GRID)), []).append(r)

    def near(self, lat: float, lng: float) -> list[dict]:
        ci, cj = int(lat / _GRID), int(lng / _GRID)
        return [r for di in (-1, 0, 1) for dj in (-1, 0, 1) for r in self.cells.get((ci + di, cj + dj), [])]


def match_site(site: dict, campsites: _Grid) -> dict | None:
    """300m 안 + 이름이 겹치는 우리 캠핑장 중 가장 가까운 것."""
    c = _coord(site)
    if not c:
        return None
    hits = [(distance_m(*c, r["latitude"], r["longitude"]), r) for r in campsites.near(*c)
            if same_name(site.get("facltNm", ""), r.get("titleDisplay") or r.get("title", ""))]
    hits = [h for h in hits if h[0] <= SAME_PLACE_M]
    return min(hits, key=lambda h: h[0])[1] if hits else None


def region_of(site: dict, neighbors: _Grid) -> tuple[str | None, str | None]:
    """가장 가까운 우리 관광지(법정동 코드가 있는 것)의 시도·시군구 코드. 5km 밖이면 모른다."""
    c = _coord(site)
    if not c:
        return None, None
    best = min(((distance_m(*c, r["latitude"], r["longitude"]), r) for r in neighbors.near(*c)),
               key=lambda h: h[0], default=None)
    if not best or best[0] > REGION_NEIGHBOR_M:
        return None, None
    return best[1].get("ldongRegnCd"), best[1].get("ldongSignguCd")


def to_attraction(site: dict, regn: str | None, signgu: str | None) -> dict:
    """새 관광지 행(국문). 개요는 원천 소개(intro, 없으면 lineIntro) — 원문은 원천 표에 그대로 있다."""
    lat, lng = _coord(site)
    intro = (site.get("intro") or "").strip() or (site.get("lineIntro") or "").strip() or None
    modified = (site.get("modifiedtime") or "").strip()
    return {
        "contentId": str(site["contentId"]),
        "lang": "ko",
        "source": "GOCAMPING",
        "title": site["facltNm"].strip(),
        "latitude": lat,
        "longitude": lng,
        "address": (site.get("addr1") or "").strip() or None,
        "ldongRegnCd": regn,
        "ldongSignguCd": signgu,
        "category": "stay",
        "tel": (site.get("tel") or "").strip() or None,
        "imageUrl": (site.get("firstImageUrl") or "").strip() or None,
        "overview": intro,
        "sourceModifiedAt": f"{modified}T00:00:00" if re.fullmatch(r"\d{4}-\d{2}-\d{2}", modified) else None,
    }


def plan(sites: list[dict], attractions: list[dict]) -> tuple[list[dict], list[dict]]:
    """(원천 표 행, 새 관광지 행). 원천 표 행은 겹친 우리 캠핑장 id 를 담는다."""
    tour_ko = [r for r in attractions if r.get("lang") == "ko" and place_client.is_tourapi(r)]
    campsites = _Grid([r for r in tour_ko if r.get("lclsSystm2") == CAMPSITE_LCLS2])
    neighbors = _Grid([r for r in tour_ko if r.get("ldongRegnCd") and r.get("ldongSignguCd")])
    now = datetime.now().replace(microsecond=0).isoformat()
    site_rows, new_rows = [], []
    for s in sites:
        cid = str(s.get("contentId") or "").strip()
        name = (s.get("facltNm") or "").strip()
        if not cid or not name:
            continue
        hit = match_site(s, campsites)
        coord = _coord(s)
        site_rows.append({
            "contentId": cid,
            "facilityName": name,
            "manageStatus": (s.get("manageSttus") or "").strip() or None,
            "latitude": coord[0] if coord else None,
            "longitude": coord[1] if coord else None,
            "itemRaw": json.dumps(s, ensure_ascii=False),
            "matchedAttractionId": hit["id"] if hit else None,
            "matchMethod": "NEAR_NAME" if hit else "NONE",
            "syncedAt": now,
        })
        if not hit and coord:
            new_rows.append(to_attraction(s, *region_of(s, neighbors)))
    return site_rows, new_rows


def run(key: str, client: datagokr.Client | None = None, attractions: list[dict] | None = None) -> dict:
    client = client or datagokr.Client(key=key, api=API, budget=2, timeout_sec=300)
    sites = fetch(client)
    log(f"원천 {len(sites):,}곳")
    if not sites:
        return {"sites": 0, "failed": True}
    rows = attractions if attractions is not None else place_client.fetch_attractions()
    site_rows, new_rows = plan(sites, rows)
    created = updated = 0
    for i in range(0, len(new_rows), place_client.BULK_CHUNK):
        c, u = place_client.bulk_upsert(new_rows[i:i + place_client.BULK_CHUNK])
        created, updated = created + c, updated + u
    applied = place_client.put_gocamping_sites(site_rows)
    matched = sum(1 for r in site_rows if r["matchedAttractionId"])
    log(f"겹침 {matched:,} · 새 관광지 {len(new_rows):,}(생성 {created} · 갱신 {updated}) · "
        f"좌표 없음 {len(site_rows) - matched - len(new_rows):,} · 원천 표 {applied}")
    return {"sites": len(sites), "matched": matched, "new": len(new_rows), "failed": False}
